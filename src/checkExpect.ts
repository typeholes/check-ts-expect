import {
   Diagnostic,
   DiagnosticMessageChain,
   Node,
   Project,
   SourceFile,
} from 'ts-morph';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const defaultConfig = {
   tsConfigFilePath: './tsconfig.json',
   checkTypeName: 'CheckedAny',
   expectTag: 'Check',
   checkTypeRegexCount: Number.MAX_SAFE_INTEGER,
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
         checkTypeRegexCount: {
            alias: 'c',
            type: 'number',
            description:
               'maximum number of regexes to check on casts. useful when the last genereic parameter of your check type is the type to cast to',
         },
      })
      .help().argv;

   const ret = { ...defaultConfig, ...args };
   return ret as { [K in keyof typeof ret]: NonNullable<(typeof ret)[K]> };
}

function check(config: typeof defaultConfig) {
   const project = new Project({
      tsConfigFilePath: config.tsConfigFilePath,
   });

   // project.addSourceFilesFromTsConfig('./tsconfig.json');

   for (const file of project.getSourceFiles()) {
      //    console.log(`file: ${file.getBaseName()}`);
      file.getStatementsWithComments().forEach((statement) => {
         const line = statement.getStartLineNumber();
         const text = statement.getText();
         if (Node.isCommentNode(statement) && text.match(/@ts-expect-error/)) {
            console.log(line, text);
            statement.remove();
            const diags = getLineDiagnostics(file, line - 1); // why -1?
            console.log(diags.map(diagToString));
         }
      });

      file.forEachDescendant((node) => {
         if (Node.isAsExpression(node)) {
            const regexes: RegExp[] = [];
            //  console.log(node.print());
            const typeNode = node.getTypeNode();
            if (!Node.isTypeReference(typeNode)) {
               return;
            }
            const typeNodeNewlines = typeNode.print().replaceAll(/[^\n]/g, '');
            const name = typeNode.getTypeName().print();
            if (name !== config.checkTypeName) {
               return;
            }
            const args = typeNode
               .getTypeArguments()
               .slice(0, config.checkTypeRegexCount);
            for (let i = 0; i < args.length; i++) {
               const arg = args[i];
               const argStr = arg.print();
               if (!Node.isLiteralTypeNode(arg)) {
                  throw new Error(`Expected literal type node, got: ${argStr}`);
               } else if (!argStr.match(/^['"].*['"]$/)) {
                  throw new Error(`expected string arg, got ${argStr}`);
               }
               //   console.log(arg.print());
               regexes.push(new RegExp(argStr.slice(1, -1)));
            }

            const tgt = node.getExpression();
            let expr = tgt;
            while (Node.isAsExpression(expr)) {
               expr = expr.getExpression();
            }

            const parent = tgt.getParent() ?? tgt;
            const grandParent = parent.getParent() ?? parent;
            const grandParentText = grandParent.print();
            const grandParentLine = grandParent.getStartLineNumber() ?? 0;
            const tgtStart = grandParent.getStart() ?? 0;
            const tgtEnd = typeNode?.getStart() ?? 0;

            //  console.log(`tgt: ${tgt?.print()}`);
            const existingMessages = getNodeDiagnostics(
               file,
               tgtStart,
               tgtEnd
            ).map(diagToString);
            //         console.log({existingMessages});

            node.replaceWithText(expr.print() + typeNodeNewlines);
            const newMessages = getNodeDiagnostics(file, tgtStart, tgtEnd)
               .map(diagToString)
               .filter((x) => !existingMessages.includes(x));

            //  console.log({newMessages});

            let passed = true;
            if (newMessages.length === 0) {
               console.log(
                  `\nCast is not needed at line ${grandParentLine} ${file.getFilePath()}`
               );
               console.log('   ' + grandParentText.replaceAll('\n', '\n   '));
            } else {
               for (const regex of regexes) {
                  if (!newMessages.some((msg) => msg.match(regex))) {
                     passed = false;
                     console.log(
                        `\nCast check failed at line ${grandParentLine} ${file.getFilePath()}`
                     );
                     console.log(
                        '   ' + grandParentText.replaceAll('\n', '\n   ')
                     );
                     newMessages.forEach((msg) => {
                        console.log('-'.repeat(30));
                        console.log('| ' + msg.replaceAll('\n', '\n   '));
                     });
                     console.log('-'.repeat(30));
                  }
               }
            if (passed && config.showValid) {
               console.log(
                  `\nValid cast at line ${grandParentLine} ${file.getFilePath()}`
               );
               console.log('   ' + grandParentText.replaceAll('\n', '\n   '));
            }
            }
         }
      });
   }

   function getLineDiagnostics(file: SourceFile, line: number | undefined) {
      return file.getPreEmitDiagnostics().filter((diag) => {
         // console.log( {line: diag.getLineNumber()})
         return diag.getLineNumber() === line;
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
