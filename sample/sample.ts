type Ignore<Check extends string, T = any> = T;

function f(n: RegExp) {
   return 1;
}

// @ts-expect-error
const a: bigint = 1;

const foo: string = f('a') as Ignore<"'number'.*assignable.*'string'">;
/* reports valid cast */

const bar: string = f('a') as Ignore<"'string'.*assignable.*'string'">;
/* reports
 * Match not found /'string'.*assignable.*'string'/ [ "Type 'number' is not assignable to type 'string'." ] in
 * bar: string = f('a') as Ignore<"'string'.*assignable.*'string'">
 */

// prettier-ignore
const baz: string = f('a') as unknown as Ignore< "'string'.*assignable.*'RegExp'", 
{ a: 1,
b:2} extends never ? string : string>;
/* reports
 * Match not found /'string'.*assignable.*'RegExp'/ [ "Type 'number' is not assignable to type 'string'." ] in
 * baz: string = f('a') as Ignore<"'string'.*assignable.*'RegExp'">
 */

const castNeeded: string = 1 as Ignore<'.'>;

const castNotNeeded: number = 1 as Ignore<'.'>;
/* reports
 * Match not found /./ [] in
 * castNotNeeded: number = 1 as Ignore<'.'>
 */
