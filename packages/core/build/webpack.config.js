/* eslint-disable */
/**
 * packages/core/build/webpack.config.js
 *
 * Self-contained webpack config for the Mkulima Trader core app.
 *
 * Why this exists:
 *   The dtrader-template ships without build/ dirs for packages/reports and
 *   packages/trader. Rather than pre-building them as separate libraries we
 *   alias both straight to their src/ directories so webpack compiles
 *   everything in one pass — no separate package pre-builds required.
 *
 * Commit this file to: packages/core/build/webpack.config.js
 */

'use strict';

const path = require('path');
const { CleanWebpackPlugin }  = require('clean-webpack-plugin');
const CssMinimizerPlugin      = require('css-minimizer-webpack-plugin');
const Dotenv                  = require('dotenv-webpack');
const HtmlWebpackPlugin       = require('html-webpack-plugin');
const MiniCssExtractPlugin    = require('mini-css-extract-plugin');
const TerserPlugin            = require('terser-webpack-plugin');
const { DefinePlugin }        = require('webpack');

// ── Paths ─────────────────────────────────────────────────────────────────────
// __dirname = packages/core/build/
const ROOT     = path.resolve(__dirname, '..', '..', '..');   // repo root
const PACKAGES = path.resolve(ROOT, 'packages');
const CORE_SRC = path.resolve(__dirname, '..', 'src');

const IS_RELEASE = process.env.NODE_ENV === 'production';
const ENV        = IS_RELEASE ? 'production' : 'staging';

// ── Brand config (read at build time to inject into index.html) ────────────────
const brand = require(path.join(ROOT, 'brand.config.json'));

// ── Loaders ───────────────────────────────────────────────────────────────────
const js_loaders = [
    {
        loader: 'babel-loader',
        options: {
            configFile:     path.join(ROOT, 'babel.config.json'),
            cacheDirectory: true,
        },
    },
];

const css_loaders = [
    MiniCssExtractPlugin.loader,
    { loader: 'css-loader',         options: { sourceMap: true } },
    { loader: 'postcss-loader',     options: { sourceMap: true } },
    { loader: 'resolve-url-loader', options: { sourceMap: true } },
    {
        loader: 'sass-loader',
        options: {
            sourceMap:   true,
            sassOptions: {
                quietDeps:           true,
                silenceDeprecations: ['legacy-js-api'],
            },
        },
    },
    {
        // Injects global SCSS variables and mixins into every stylesheet
        loader: 'sass-resources-loader',
        options: {
            resources: require('@deriv/shared/src/styles/index.js'),
        },
    },
];

// ── Main config ───────────────────────────────────────────────────────────────
module.exports = function (env) {
    const base = env && env.base && env.base !== true ? `/${env.base}/` : '/';

    return {
        context: CORE_SRC,
        entry:   './index.tsx',
        mode:    IS_RELEASE ? 'production' : 'development',
        devtool: IS_RELEASE ? 'source-map' : 'eval-cheap-module-source-map',

        output: {
            filename:      'js/core.[name].[fullhash].js',
            chunkFilename: 'js/core.chunk.[name].[fullhash].js',
            publicPath:    base,
            path:          path.resolve(__dirname, '../dist'),
        },

        resolve: {
            alias: {
                // ── Core internal path aliases ─────────────────────────────
                _common:   path.join(CORE_SRC, '_common'),
                App:       path.join(CORE_SRC, 'App'),
                Assets:    path.join(CORE_SRC, 'Assets'),
                Constants: path.join(CORE_SRC, 'Constants'),
                Modules:   path.join(CORE_SRC, 'Modules'),
                Sass:      path.join(CORE_SRC, 'sass'),
                Services:  path.join(CORE_SRC, 'Services'),
                Stores:    path.join(CORE_SRC, 'Stores'),
                Utils:     path.join(CORE_SRC, 'Utils'),

                // ── Workspace packages whose main → dist/ (not yet built) ──
                // Point directly to source so webpack compiles them inline.
                '@deriv/reports': path.join(PACKAGES, 'reports', 'src'),
                '@deriv/trader':  path.join(PACKAGES, 'trader',  'src'),

                // ── Deduplicate React across the monorepo ──────────────────
                react:               path.join(ROOT, 'node_modules', 'react'),
                'react-dom':         path.join(ROOT, 'node_modules', 'react-dom'),
                'react/jsx-runtime': path.join(ROOT, 'node_modules', 'react', 'jsx-runtime.js'),
            },
            extensions: ['.js', '.jsx', '.ts', '.tsx'],
            symlinks:   false,
        },

        module: {
            rules: [
                // Allow CommonJS .mjs files from node_modules (e.g. some ESM-only packages)
                {
                    test:    /\.m?js$/,
                    include: /node_modules/,
                    resolve: { fullySpecified: false },
                },
                // TypeScript + JSX
                {
                    test:    /\.(js|jsx|ts|tsx)$/,
                    exclude: /node_modules/,
                    use:     js_loaders,
                },
                // HTML imports inside JS (not the index.html template)
                {
                    test:    /\.html$/,
                    exclude: /node_modules/,
                    use:     [{ loader: 'html-loader' }],
                },
                // Fonts and raster images
                {
                    test:      /\.(png|jpg|gif|woff|woff2|eot|ttf|otf|pdf)$/,
                    exclude:   /node_modules/,
                    type:      'asset/resource',
                    generator: { filename: 'media/[name].[hash][ext]' },
                },
                // SVGs inside public/ → serve as static file references
                {
                    test:      /\.svg$/,
                    include:   /public[/\\]/,
                    type:      'asset/resource',
                    generator: { filename: 'media/[name].[hash][ext]' },
                },
                // SVGs outside public/ → inline as React components
                {
                    test:    /\.svg$/,
                    exclude: [/node_modules/, /public[/\\]/],
                    use: [{ loader: 'react-svg-loader', options: { svgo: false } }],
                },
                // Styles
                {
                    test: /\.(sc|sa|c)ss$/,
                    use:  css_loaders,
                },
            ],
        },

        plugins: [
            new CleanWebpackPlugin(),

            // Load .env from repo root (OAUTH_CLIENT_ID etc.)
            // silent:true → don't throw when .env is absent (Vercel injects vars directly)
            // systemvars:true → also expose real env vars set in the Vercel dashboard
            new Dotenv({
                path:       path.join(ROOT, '.env'),
                silent:     true,
                systemvars: true,
            }),

            new DefinePlugin({
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
            }),

            new HtmlWebpackPlugin({
                template: path.join(CORE_SRC, 'index.html'),
                filename: 'index.html',
                minify:   IS_RELEASE,
                templateParameters: {
                    brand_name:           brand.brand_name,
                    platform_name:        brand.platform.name,
                    platform_description: brand.platform.description,
                    theme_color:          brand.colors.primary,
                    api_core_url:         `https://${brand.api_core[ENV]}`,
                    api_url:              `https://${brand.api[ENV]}`,
                    auth_url:             brand.auth[ENV],
                    canonical_url:        `https://${brand.brand_hostname[ENV]}`,
                },
            }),

            new MiniCssExtractPlugin({
                filename:      IS_RELEASE ? 'css/core.[name].[fullhash].css'       : 'css/core.[name].css',
                chunkFilename: IS_RELEASE ? 'css/core.chunk.[name].[fullhash].css' : 'css/core.chunk.[name].css',
            }),
        ],

        optimization: {
            minimize:  IS_RELEASE,
            minimizer: [
                new TerserPlugin({ test: /\.js$/, exclude: /smartcharts/, parallel: 2 }),
                new CssMinimizerPlugin(),
            ],
            splitChunks: {
                chunks:  'all',
                maxSize: 2_500_000,
                cacheGroups: {
                    vendors: {
                        idHint: 'vendors',
                        test:   /[\\/]node_modules[\\/]/,
                        priority: -10,
                    },
                    default: {
                        minChunks:            2,
                        priority:             -20,
                        reuseExistingChunk:   true,
                    },
                },
            },
        },

        devServer: {
            host:               'localhost',
            port:               8443,
            server:             'https',
            hot:                false,
            historyApiFallback: true,
            client:             { overlay: false },
            static:             { publicPath: base, watch: true },
        },

        stats: { colors: true },
    };
};
