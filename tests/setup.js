// Mock Electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name) => {
      if (name === 'userData') return '/mock/userData';
      if (name === 'temp') return '/mock/temp';
      return `/mock/${name}`;
    }),
    getVersion: jest.fn(() => '1.0.0'),
    getName: jest.fn(() => 'blackbox-ai'),
    on: jest.fn(),
    once: jest.fn(),
    whenReady: jest.fn().mockResolvedValue({}),
    quit: jest.fn(),
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      on: jest.fn(),
    },
    on: jest.fn(),
    show: jest.fn(),
    maximize: jest.fn(),
    setMenu: jest.fn(),
  })),
  Menu: {
    setApplicationMenu: jest.fn(),
    buildFromTemplate: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn(),
  },
  screen: {
    getAllDisplays: jest.fn().mockReturnValue([
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        scaleFactor: 1,
        rotation: 0,
        internal: true,
      },
    ]),
    getPrimaryDisplay: jest.fn().mockReturnValue({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
      rotation: 0,
      internal: true,
    }),
  },
  desktopCapturer: {
    getSources: jest.fn().mockResolvedValue([
      {
        id: 'screen:1',
        name: 'Screen 1',
        thumbnail: {
          toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data')),
          getSize: jest.fn().mockReturnValue({ width: 1920, height: 1080 }),
        },
        display_id: '1',
      },
    ]),
  },
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('mock-file-data')),
  statSync: jest.fn().mockReturnValue({
    size: 1024,
    isDirectory: jest.fn().mockReturnValue(true),
  }),
  readdirSync: jest.fn().mockReturnValue(['file1.txt', 'file2.txt']),
  unlinkSync: jest.fn(),
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  }),
  createReadStream: jest.fn().mockReturnValue({
    pipe: jest.fn(),
    on: jest.fn(),
  }),
  promises: {
    readFile: jest.fn().mockResolvedValue(Buffer.from('mock-file-data')),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({
      size: 1024,
      isDirectory: jest.fn().mockReturnValue(true),
    }),
    readdir: jest.fn().mockResolvedValue(['file1.txt', 'file2.txt']),
  },
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  }),
  parse: jest.fn((path) => {
    const parts = path.split('/');
    const filename = parts.pop() || '';
    const filenameWithoutExt = filename.split('.')[0];
    const ext = filename.includes('.') ? `.${filename.split('.').pop()}` : '';
    return {
      root: '',
      dir: parts.join('/'),
      base: filename,
      name: filenameWithoutExt,
      ext,
    };
  }),
}));

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
  put: jest.fn().mockResolvedValue({ data: {} }),
  delete: jest.fn().mockResolvedValue({ data: {} }),
  request: jest.fn().mockResolvedValue({ data: {} }),
  create: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    request: jest.fn().mockResolvedValue({ data: {} }),
  }),
  defaults: {
    headers: {
      common: {},
    },
  },
}));

// Mock sequelize
jest.mock('sequelize', () => {
  const mSequelize = {
    authenticate: jest.fn().mockResolvedValue(),
    define: jest.fn().mockReturnValue({
      sync: jest.fn().mockResolvedValue({}),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue([1]),
      destroy: jest.fn().mockResolvedValue(1),
      count: jest.fn().mockResolvedValue(0),
    }),
    sync: jest.fn().mockResolvedValue({}),
    transaction: jest.fn().mockImplementation((fn) => fn()),
    literal: jest.fn().mockReturnValue(''),
    fn: jest.fn().mockReturnValue(''),
    col: jest.fn().mockReturnValue(''),
    where: jest.fn().mockReturnValue({}),
    Op: {
      eq: Symbol('eq'),
      ne: Symbol('ne'),
      gte: Symbol('gte'),
      gt: Symbol('gt'),
      lte: Symbol('lte'),
      lt: Symbol('lt'),
      in: Symbol('in'),
      notIn: Symbol('notIn'),
      like: Symbol('like'),
      notLike: Symbol('notLike'),
      between: Symbol('between'),
      notBetween: Symbol('notBetween'),
      and: Symbol('and'),
      or: Symbol('or'),
    },
    DataTypes: {
      STRING: 'STRING',
      TEXT: 'TEXT',
      INTEGER: 'INTEGER',
      FLOAT: 'FLOAT',
      BOOLEAN: 'BOOLEAN',
      DATE: 'DATE',
      JSON: 'JSON',
      JSONB: 'JSONB',
      BLOB: 'BLOB',
      UUID: 'UUID',
      UUIDV4: 'UUIDV4',
      VIRTUAL: 'VIRTUAL',
    },
  };

  return jest.fn(() => mSequelize);
});

// Mock screenshot-desktop
jest.mock('screenshot-desktop', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(Buffer.from('mock-screenshot-data')),
}));

// Mock sharp
jest.mock('sharp', () => {
  const mockSharp = jest.fn().mockReturnValue({
    resize: jest.fn().mockReturnThis(),
    rotate: jest.fn().mockReturnThis(),
    flip: jest.fn().mockReturnThis(),
    flop: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    blur: jest.fn().mockReturnThis(),
    gamma: jest.fn().mockReturnThis(),
    negate: jest.fn().mockReturnThis(),
    normalize: jest.fn().mockReturnThis(),
    threshold: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-sharp-data')),
    toFile: jest.fn().mockResolvedValue({}),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    tiff: jest.fn().mockReturnThis(),
    raw: jest.fn().mockReturnThis(),
    metadata: jest.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg',
      size: 1024,
    }),
  });

  mockSharp.cache = jest.fn().mockReturnValue(mockSharp);
  mockSharp.concurrency = jest.fn().mockReturnValue(mockSharp);
  mockSharp.counters = jest.fn().mockReturnValue({});
  mockSharp.simd = jest.fn().mockReturnValue(true);
  mockSharp.format = jest.fn().mockReturnValue({});
  mockSharp.versions = {
    vips: '8.10.5',
  };

  return mockSharp;
});

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn((size) => Buffer.alloc(size)),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash'),
  })),
  createCipheriv: jest.fn(() => ({
    update: jest.fn().mockReturnValue(Buffer.from('mock-encrypted-data')),
    final: jest.fn().mockReturnValue(Buffer.from('mock-encrypted-final')),
  })),
  createDecipheriv: jest.fn(() => ({
    update: jest.fn().mockReturnValue(Buffer.from('mock-decrypted-data')),
    final: jest.fn().mockReturnValue(Buffer.from('mock-decrypted-final')),
  })),
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hmac'),
  })),
  scrypt: jest.fn((password, salt, keylen, options, callback) => {
    if (callback) {
      callback(null, Buffer.alloc(keylen));
    } else {
      return Buffer.alloc(keylen);
    }
  }),
  scryptSync: jest.fn(() => Buffer.alloc(32)),
}));

// Mock os
jest.mock('os', () => ({
  platform: jest.fn().mockReturnValue('win32'),
  release: jest.fn().mockReturnValue('10.0.19042'),
  arch: jest.fn().mockReturnValue('x64'),
  cpus: jest.fn().mockReturnValue([
    {
      model: 'Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz',
      speed: 2600,
      times: {
        user: 9559860,
        nice: 0,
        sys: 5538800,
        idle: 35154140,
        irq: 468750,
      },
    },
  ]),
  totalmem: jest.fn().mockReturnValue(16 * 1024 * 1024 * 1024),
  freemem: jest.fn().mockReturnValue(8 * 1024 * 1024 * 1024),
  homedir: jest.fn().mockReturnValue('/mock/home'),
  tmpdir: jest.fn().mockReturnValue('/mock/tmp'),
  hostname: jest.fn().mockReturnValue('mock-hostname'),
  userInfo: jest.fn().mockReturnValue({
    username: 'mock-user',
    uid: 1000,
    gid: 1000,
    shell: '/bin/bash',
    homedir: '/mock/home',
  }),
  networkInterfaces: jest.fn().mockReturnValue({
    lo: [
      {
        address: '127.0.0.1',
        netmask: '255.0.0.0',
        family: 'IPv4',
        mac: '00:00:00:00:00:00',
        internal: true,
        cidr: '127.0.0.1/8',
      },
    ],
    eth0: [
      {
        address: '192.168.1.100',
        netmask: '255.255.255.0',
        family: 'IPv4',
        mac: '00:00:00:00:00:00',
        internal: false,
        cidr: '192.168.1.100/24',
      },
    ],
  }),
  EOL: '\n',
}));

// Global mocks
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
