declare module "a" {
    interface I { i: any }
    export = I;
}

declare module "b" {
    import a from "a";
}
