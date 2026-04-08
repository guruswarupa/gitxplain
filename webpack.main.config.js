const path = require('path');

module.exports = {
  entry: {
    main: './src/main/index.ts',
    preload: './src/main/preload.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  target: 'electron-main',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  externals: {
    electron: 'commonjs2 electron',
  },
};
