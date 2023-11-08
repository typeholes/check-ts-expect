import {
   Diagnostic,
   DiagnosticMessageChain,
   Expression,
   Node,
   Project,
   SourceFile,
   SyntaxKind,
} from 'ts-morph';

type Ignore<T extends string> = any;

const project = new Project({
   tsConfigFilePath: './tsconfig.json',
});

// project.addSourceFilesFromTsConfig('./tsconfig.json');

for (const file of project.getSourceFiles()) {
//    console.log(`file: ${file.getBaseName()}`);
   file.forEachDescendant((node) => {
      if (Node.isAsExpression(node)) {
   const regexes: RegExp[] = [];
        //  console.log(node.print());
         const typeNode = node.getTypeNode();
         if (Node.isTypeReference(typeNode)) {
            const name = typeNode.getTypeName().print();
            if (name === 'Ignore') {
               const args = typeNode.getTypeArguments();
               for (const arg of args) {
                  const argStr = arg.print();
                  if (!Node.isLiteralTypeNode(arg)) {
                     throw new Error(
                        `Expected literal type node, got: ${argStr}`
                     );
                  }
                  if (!argStr.match(/^['"].*['"]$/)) {
                     throw new Error(`expected string arg, got ${argStr}`);
                  }
                //   console.log(arg.print());
                  regexes.push(new RegExp(argStr.slice(1,-1)));
               }
            }
         }

         const tgt = node.getExpression();

         const parent = tgt.getParent()??tgt;
         const grandParent = parent.getParent()??parent;
         const grandParentText = grandParent.print();
         const tgtStart = tgt.getParent()?.getParent()?.getStart() ?? 0;
         const tgtEnd = typeNode?.getStart() ?? 0;

        //  console.log(`tgt: ${tgt?.print()}`);
         const existingMessages = getNodeDiagnostics(
            file,
            tgtStart,
            tgtEnd
         ).map(diagToString);
//         console.log({existingMessages});

         node.replaceWithText(tgt.print());
         const newMessages = getNodeDiagnostics(file, tgtStart, tgtEnd)
            .map(diagToString)
            .filter((x) => !existingMessages.includes(x));

        //  console.log({newMessages});

         for (const regex of regexes) {
            if (! newMessages.some( msg => msg.match(regex))) {
                console.log('Match not found', regex, newMessages, 'in')
                console.log(grandParentText);
            }
         }
      }
   });
}

function getNodeDiagnostics(
   file: SourceFile,
   tgtStart: number,
   tgtEnd: number
) {
   return file.getPreEmitDiagnostics().filter((diag) => {
      const diagStart = diag.getStart() ?? -1;
    //   console.log({
    //      tgtStart,
    //      diagStart,
    //      tgtEnd,
    //      overlaps: diagStart >= tgtStart && diagStart <= tgtEnd,
    //   });
      return  diagStart >= tgtStart && diagStart <= tgtEnd;
   });
}


function diagToString(diag: Diagnostic|DiagnosticMessageChain): string {
   const msg = diag.getMessageText();
   if (typeof msg === 'string') {
      return msg;
   }
   return (
      msg.getMessageText() +
      (msg.getNext() ?? [])
         .map(diagToString)
         .join('\n')
   );
}
function f(n: RegExp) { return 1; }

const foo: string = f('a') as Ignore<"'number'.*assignable.*'string'">;
/** reports nothing */ 

const bar: string = f('a') as Ignore<"'string'.*assignable.*'string'">;
/** reports
 * Match not found /'string'.*assignable.*'string'/ [ "Type 'number' is not assignable to type 'string'." ] in
 * bar: string = f('a') as Ignore<"'string'.*assignable.*'string'">
 */

const baz: string = f('a') as Ignore<"'string'.*assignable.*'RegExp'">;
/** reports 
 * Match not found /'string'.*assignable.*'RegExp'/ [ "Type 'number' is not assignable to type 'string'." ] in
 * baz: string = f('a') as Ignore<"'string'.*assignable.*'RegExp'">
 */

const castNotNeeded : number = 1 as Ignore<'.'>;
/** reports
 * Match not found /./ [] in
 * castNotNeeded: number = 1 as Ignore<'.'>
 */