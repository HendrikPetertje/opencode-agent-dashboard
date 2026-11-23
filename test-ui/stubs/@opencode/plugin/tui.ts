export const Plugin = { define: (plugin: any) => plugin };
let current: any;
export const setCurrent = (ctx: any) => (current = ctx);
export const usePlugin = () => current;
