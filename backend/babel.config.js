module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
            '@src': './src',
            '@services': './src/services',
            '@components': './components',
          },
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
        }
      ]
    ],
  };
};
