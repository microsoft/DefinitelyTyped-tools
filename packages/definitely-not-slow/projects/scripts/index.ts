if (!module.parent) {
  const args = buildArgs(process.argv);
}

function buildArgs(args: string[]): { [key: string]: string | boolean } {
  const obj: { [key: string]: string | boolean } = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const nextArg = args[i + 1];
      if (!nextArg || nextArg.startsWith('--')) {
        obj[arg.slice(2)] = true;
      } else {
        obj[arg.slice(2)] = nextArg;
        i++;
      }
    }
  }
  return obj;
}