declare module "a" {
    interface I {}
    export = I;
}

declare module "b" {
    import a from "a";
}
