# check-ts-expect
Command line tool to validate casts and //@ts-expect-error directives

## Alpha Warning

    This tool is in early alpha and not ready for production use.
    Feel free to play with it, but do not rely on it.
    //@ts-expect-error validation is not yet implemented


## Installation
    git clone https://github.com/typeholes/check-ts-expect.git
    cd check-ts-expect
    npm i
    ./build.sh
    bin/checkExpect --version

## Sample
A sample source file is provided. run the run_sample.sh script to see the sample output

## Usage
You will need to have a type to use for validated casts. It must be generic with one or more leading parameters extending string. Arguments passed to these types will be treated as regexes that must match the error message they are masking.  For example:
```ts
type CheckMe<_Regex extends string> = any
// this will only validate an error message is swallowed
const s : string = 1 as CheckMe<'.'>
```

You can use the -c option to limit the number of parameters treated as regexes.  This is useful to allow a final parameter to specify what to cast to.  For example
```ts
type CheckMe<_Regex extends string, To = any> = To
// now you can cast to string
const s : string = 1 as unknown as CheckMe<'.',string>
```

## Options:
<pre>
      --version              Show version number                       [boolean]   

  -p, --tsConfigFilePath     Path to the tsconfig file of the project to check   
                                           [string] [default: "./tsconfig.json"]   
      --checkTypeName        Type name to trigger cast checks. Should be defined like `type CheckedAny<T extends string> = any`   
                                                [string] [default: "CheckedAny"]   
      --expectTag            not yet implemented     [string] [default: "Check"]   
  -v, --showValid            Show checks that pass as well   
                                                      [boolean] [default: false]   
  -c, --checkTypeRegexCount  maximum number of regexes to check on casts. useful when the last genereic parameter of your check type is the type to cast to   
                                            [number] [default: 9007199254740991]   
      --help                 Show help                                 [boolean]   
</pre>

