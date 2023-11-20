declare module "foo" {}

// Other global declarations don't affect this. They should go in "declare global".
interface I { i: any }
