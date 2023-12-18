declare module "agood" {
    interface I { i: any }
    export default I;
}

declare module "bgood" {
    import a from "agood";
}
