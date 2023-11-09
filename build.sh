if  which esbuild > /dev/null; then
esbuild --bundle src/checkExpect.ts --outfile=out/checkExpect.js --platform=node
else
tsc -p
fi

