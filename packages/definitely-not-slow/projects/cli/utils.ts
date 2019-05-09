export function cliArgumentError(argName: string, typeName: string, value: unknown, required = false): never {
  if (typeof value === 'undefined' && required) {
    throw new Error(`Argument '${argName}' is required.`);
  }
  throw new Error(`Invalid value for argument '${argName}': expected a ${typeName} but received a ${typeof value}.`);
}
