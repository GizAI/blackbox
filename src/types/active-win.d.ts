declare module 'active-win' {
  interface BaseOwner {
    name: string;
    path: string;
  }

  interface MacOSOwner extends BaseOwner {
    bundleId: string;
  }

  interface WindowsOwner extends BaseOwner {
    processId: number;
  }

  interface LinuxOwner extends BaseOwner {
    processId: number;
  }

  export interface Result {
    title: string;
    id: number;
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    owner: MacOSOwner | WindowsOwner | LinuxOwner;
    memoryUsage: number;
  }

  export interface Options {
    screenRecordingPermission?: boolean;
  }

  export default function activeWin(options?: Options): Promise<Result | undefined>;
  export function sync(options?: Options): Result | undefined;
  export function getOpenWindows(options?: Options): Promise<Result[]>;
  export function getOpenWindowsSync(options?: Options): Result[];
}
