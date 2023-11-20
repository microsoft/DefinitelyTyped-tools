declare module "agood" {
    interface I {}
    export default I;
}

declare module "bgood" {
    import a from "agood";
}
