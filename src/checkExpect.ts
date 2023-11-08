import { Console } from 'console';
import {
   Diagnostic,
   DiagnosticMessageChain,
   Node,
   Project,
   SourceFile,
} from 'ts-morph';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

type Ignore<T extends string> = any;

const defaultConfig = {
   tsConfigFilePath: './tsconfig.json',
   checkTypeName: 'CheckedAny',
   expectTag: 'Check',
   showValid: false,
};

async function handleCommandLineArgs() {
   const args = await yargs(hideBin(process.argv))
      .default(defaultConfig)
      .options({
         tsConfigFilePath: {
            alias: 'p',
            type: 'string',
            description: 'Path to the tsconfig file of the project to check',
         },
         checkTypeName: {
            type: 'string',
            description:
               'Type name to trigger cast checks\n should be defined like `type CheckedAny<T extends string> = any`',
         },
         expectTag: {
            type: 'string',
            description: 'not yet implemented',
         },
         showValid: {
            alias: 'v',
            type: 'boolean',
            description: 'Show checks that pass as well',
         },
      })
      .help().argv;

   return args;
}

function check(config: typeof defaultConfig) {
   const project = new Project({
      tsConfigFilePath: config.tsConfigFilePath,
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
               if (name === config.checkTypeName) {
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
                     regexes.push(new RegExp(argStr.slice(1, -1)));
                  }
               }
            }

            const tgt = node.getExpression();

            const parent = tgt.getParent() ?? tgt;
            const grandParent = parent.getParent() ?? parent;
            const grandParentText = grandParent.print();
            const grandParentLine = grandParent.getStartLineNumber() ?? 0;
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

            let passed = true;
            for (const regex of regexes) {
               if (!newMessages.some((msg) => msg.match(regex))) {
                  passed = false;
                  console.log(`Cast check failed at line ${grandParentLine}`);
                  console.log(
                     '   ' + grandParentText.replaceAll('\n', '\n   ')
                  );
                  if (newMessages.length > 0) {
                     newMessages.forEach((msg) => {
                        console.log('-'.repeat(30));
                        console.log('| ' + msg.replaceAll('\n', '\n   '));
                     });
                     console.log('-'.repeat(30));
                  } else {
                     console.log('> Cast is not needed');
                  }
               }
            }
            if (passed && config.showValid) {
               console.log(`Valid cast at line ${grandParentLine}`);
               console.log('   ' + grandParentText.replaceAll('\n', '\n   '));
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
         return diagStart >= tgtStart && diagStart <= tgtEnd;
      });
   }

   function diagToString(diag: Diagnostic | DiagnosticMessageChain): string {
      const msg = diag.getMessageText();
      if (typeof msg === 'string') {
         return msg;
      }
      return (
         msg.getMessageText() +
         (msg.getNext() ?? []).map(diagToString).join('\n')
      );
   }
}

handleCommandLineArgs().then(check);

function f(n: RegExp) {
   return 1;
}

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

const castNotNeeded: number = 1 as Ignore<'.'>;
/** reports
 * Match not found /./ [] in
 * castNotNeeded: number = 1 as Ignore<'.'>
 */
