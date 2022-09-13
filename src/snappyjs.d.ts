declare module "snappyjs" {
  const snappyjs: {
    compress: <T extends ArrayBuffer>(input: T) => T;
    uncompress: <T extends ArrayBuffer>(input: T, maxLength?: number) => T;
  };
  export default snappyjs;
}
