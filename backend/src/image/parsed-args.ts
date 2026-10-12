export type ImageFormat = 'avif' | 'webp';

export class ParsedArgs {
  public fileSuffix: string = '';
  public gravity?:
    | 'north'
    | 'northeast'
    | 'southeast'
    | 'south'
    | 'southwest'
    | 'west'
    | 'northwest'
    | 'east'
    | 'center';
  public strategy?: 'attention' | 'entropy';

  constructor(
    args: string,
    public readonly format: ImageFormat = 'avif',
  ) {
    if (!args) {
      return;
    }

    const gravityMap: Record<string, typeof this.gravity> = {
      n: 'north',
      e: 'east',
      s: 'south',
      w: 'west',
    };

    const strategyMap: Record<string, typeof this.strategy> = {
      a: 'attention',
      e: 'entropy',
    };

    if (args.startsWith('g:')) {
      this.gravity = gravityMap[args.split(':')[1]];
    } else if (args.startsWith('s:')) {
      this.strategy = strategyMap[args.split(':')[1]];
    }

    this.fileSuffix = '-' + args.replace(':', '-');
  }

  // Flags are path segments like "/f:webp/g:n" and may come in any order.
  // Returns null if an argument is repeated or gravity and strategy collide.
  static fromUrlFlags(flags: string): ParsedArgs | null {
    const segments = flags ? flags.slice(1).toLowerCase().split('/') : [];
    const crop = segments.filter((segment) => !segment.startsWith('f:'));
    const formats = segments.filter((segment) => segment.startsWith('f:'));

    if (crop.length > 1 || formats.length > 1) {
      return null;
    }

    return new ParsedArgs(
      crop[0],
      formats[0]?.slice(2) as ImageFormat | undefined,
    );
  }

  static fromFileName(imageFile: string): ParsedArgs {
    const { args, format } =
      /(?:-(?<args>g-[news]|s-[ea]))?\.(?<format>avif|webp)$/.exec(
        imageFile,
      ).groups;
    return new ParsedArgs(args?.replace('-', ':'), format as ImageFormat);
  }

  public toString() {
    return `${this.fileSuffix}.${this.format}`;
  }
}
