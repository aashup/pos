module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // WatermelonDB @field/@children/@relation decorators
    ['@babel/plugin-proposal-decorators', {legacy: true}],
    // @/* path alias mirroring tsconfig.json
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './',
        },
      },
    ],
  ],
};
