module.exports = {
  presets: [
    ['module:@react-native/babel-preset', { jsxImportSource: 'nativewind' }],
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    'nativewind/babel',
  ],
};
