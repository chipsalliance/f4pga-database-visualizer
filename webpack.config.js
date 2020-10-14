const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');


function commonConfig(dirs) {
  return {
    entry: path.resolve(dirs.SRC, 'app.js'),
    output: {
      path: dirs.DIST
    },
    plugins: [
      new HtmlWebpackPlugin({
        inject: false,
        hash: true,
        template: path.resolve(dirs.SRC, 'index.ejs'),
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
                  includePaths: [dirs.NODE_MODULES],
                  sourceMap: true
                }
              }
            } // sass-loader
          ] // use
        } // scss
      ] // rules
    } // module
  }
};

const configs = {
  production: (dirs) => {
    return {
      ...commonConfig(dirs),
      mode: 'production',
      watch: false,
      devtool: '',
    };
  },

  development: (dirs) => {
    return {
      ...commonConfig(dirs),
      mode: 'development',
      watch: true,
      watchOptions: {
        ignored: /node_modules/
      },
      devtool: "source-map",
      devServer: {
        contentBase: dirs.EXAMPLES
      },
    };
  }
};


module.exports = (env) => {
  if (!env.NODE_ENV) {
    env.NODE_ENV = "development";
    console.warn(`'env.NODE_ENV' not set, defaulting to '${env.NODE_ENV}'.`);
  } else if (!Object.keys(configs).includes(env.NODE_ENV)) {
    console.error(`'env.NODE_ENV' has invalid value: '${env.NODE_ENV}'. ` +
                  `Allowed values: ${Object.keys(configs).join(", ")}.`);
  }

  const dirs = {
    TOP: __dirname,
    SRC: path.resolve(__dirname, 'src'),
    NODE_MODULES: path.resolve(__dirname, 'node_modules'),
    EXAMPLES: path.resolve(__dirname, 'examples'),
    DIST: path.resolve(__dirname, 'dist', env.NODE_ENV),
  };

  return configs[env.NODE_ENV](dirs);
}
