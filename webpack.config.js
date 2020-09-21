const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'development',
  watch: true,
  watchOptions: {
    ignored: /node_modules/
  },
  devtool: "source-map",

  entry: './src/app.js',
  plugins: [
    new HtmlWebpackPlugin({
      inject: false,
      hash: true,
      template: './src/index.ejs',
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[id].css',
    })
  ], // plugins
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          { // sass-loader
            loader: 'sass-loader',
            options: {
              implementation: require('dart-sass'),
              sassOptions: {
                includePaths: ['./node_modules'],
                sourceMap: true
              }
            }
          } // sass-loader
        ] // use
      } // scss
    ] // rules
  } // module
};
