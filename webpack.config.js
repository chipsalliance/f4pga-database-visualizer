const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

module.exports = {
  mode: 'development',
  watch: true,
  watchOptions: {
    ignored: /node_modules/
  },
  devtool: "source-map",
  devServer: {
    contentBase: path.join(__dirname, 'examples')
  },

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
