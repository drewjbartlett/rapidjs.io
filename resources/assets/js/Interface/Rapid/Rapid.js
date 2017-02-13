import axios from 'axios';

import pluralize from 'pluralize';
import _defaultsDeep from 'lodash.defaultsdeep';
import _isArray from 'lodash.isarray';
import _kebabCase from 'lodash.kebabcase';

import Debugger from './Debugger';
import Logger from './Logger';


class Rapid {
    constructor (config) {
        let defaults = {
            modelName: this.constructor.name,

            primaryKey: '',

            baseURL: 'api',

            trailingSlash: false,

            caseSensitive: false,

            routeDelimeter: '-',

            globalParameters: {
                /**
                 * Need an option for global GET and POST params...
                 * what if we want to do /users/drew/save?api_key=12345
                 */
            },

            suffixes: {
                create : 'create',
                update : 'update',
                destroy : 'destroy',
            },

            methods: {
                create : 'post',
                update : 'post',
                destroy : 'post'
            },

            routes: {
                model      : '',
                collection : '',
                any        : ''
            },

            defaultRoute: 'model',

            debug: false,

            apiConfig: {

            }
        };

        config = config || {};

        this.config = _defaultsDeep(config, defaults);

        if(!this.config.routes.model) {
            this.setModelRoute();
        }

        if(!this.config.routes.collection) {
            this.setCollectionRoute();
        }

        this.api          = axios.create(_defaultsDeep({ baseURL: this.config.baseURL.replace(/\/$/, '') }, this.config.apiConfig));

        this.currentRoute = this.config.defaultRoute;

        this.debugger     = this.debug ? new Debugger(this)     : false;

        this.resetRequestData();

    }

    /**
     * URL functions
     */
    makeUrl (...params) {

        if(this.config.trailingSlash) {
            params.push('');
        }

        let url = this.sanitizeUrl([this.config.routes[this.currentRoute]].concat(params).join('/'));

        // reset currentRoute
        this.currentRoute = 'model';

        return url;
    }

    sanitizeUrl (url) {
        url = url.replace(/([^:]\/)\/+/g, '$1').replace(/\?$/, '');

        if(!this.config.trailingSlash) {
            url = url.replace(/\/$/, '');
        }

        return url;
    }


    /**
     * Model Only Functions
     */

    find (id) {
        return this.model.findBy(this.config.primaryKey, id);
    }

    updateOrDestroy(method, ...params) {
        let urlParams = [],
            id        = params[0],
            data      = params[1],
            options   = params[2];

        if(Number.isInteger(id)) {
            if(this.primaryKey) {
                urlParams.push(this.primaryKey);
            }
            urlParams.push(id);
        } else {
            data    = params[0];
            options = params[1];
        }

        if(this.config.suffixes[method]) {
            urlParams.push(this.config.suffixes[method]);
        }

        return this.request(this.config.methods[method], this.model.makeUrl.call(this, ...urlParams), data, options);
    }

    // update (id = 0, data, options) {
    update (...params) {
        return this.updateOrDestroy('update', ...params);
    }

    // alias
    save (...params) {
        return this.update(...params);
    }

    // remove this to replace with destroy
    destroy (...params) {
        return this.updateOrDestroy('destroy', ...params);
    }

    create (data, options) {
        return this.request(this.config.methods.create, this.model.makeUrl(this.config.suffixes.create), data, options);
    }



    /**
     * Collection Only Functions
     */

    all () {
        return this.collection.get();
    }

    /**
     * Collection and Model functions
     */

    findBy (key, value, data, options) {
        let urlParams = [key];

        if(value) {
            urlParams.push(value);
        }

        return this.request('get', this.makeUrl(...urlParams), data, options);
    }

    /**
     * Relationships
     */

    // primray key, foreign key, relation


    hasRelationship (relation, primaryKey, foreignKey, data, requestOptions) {
        let url = '';

        if(_isArray(foreignKey)) {
            url = this.makeUrl(primaryKey, relation, ...foreignKey);
        } else {
            url = this.makeUrl(primaryKey, relation, foreignKey)
        }

        return this.request('get', url, data, requestOptions);
    }

    /**
     * belongsTo
     */
    belongsTo (relation, foreignKey, data, foreignKeyName, requestOptions) {
        let route     = this.currentRoute,
            urlParams = [relation];

        if(foreignKeyName) {
            urlParams.push(foreignKeyName);
        }

        urlParams.push(foreignKey);
        urlParams.push(this.routes[route]);

        return this.request('get', this.any.makeUrl(...urlParams), data, requestOptions);
    }

    /**
     * The Request
     */

    parseRequestData (type) {
        let requestData = [],
            params        = this.requestData.params,
            options       = this.requestData.options;

        // axios handles the options differently for the request type
        if(['put', 'post', 'patch'].includes(type)) {
            params = _defaultsDeep(params, this.config.globalParameters);
            requestData.push(params);
            requestData.push(options);
        } else {
            options.params = _defaultsDeep(params, this.config.globalParameters);
            requestData.push(options);
        }

        return requestData;
    }

    request (type, url) {

        if(this.debug) {
            return this.debugger.fakeRequest(type, url);
        }

        return new Promise((resolve, reject) => {
            this.api[type].call(this, this.sanitizeUrl(url), ...this.parseRequestData(type))
                 .then(response => {
                    this.resetRequestData();

                    resolve(response);
                 })
                 .catch(error => {
                    this.resetRequestData();

                    reject(error.response);
                 });
        });
    }

    resetRequestData () {
        this.requestData = {
            params: {},
            options: {}
        };
    }

    /**
     * to build a request url
     */
    buildRequest (type, urlParams) {
        let url = _isArray(urlParams) ? this.makeUrl(...urlParams) : this.makeUrl(urlParams);

        return this.request(type, url);
    }

    get (...params) {
        return this.buildRequest('get', ...params);
    }

    post (...params) {
        return this.buildRequest('post', ...params);
    }

    put (...params) {
        return this.buildRequest('put', ...params);
    }

    patch (...params) {
        return this.buildRequest('patch', ...params);
    }

    head (...params) {
        return this.buildRequest('head', ...params);
    }

    post (...params) {
        return this.buildRequest('post', ...params);
    }


    /**
     * params, options, and headers
     */

    with (data = {}) {
        this.requestData = _defaultsDeep(data, this.requestData);
        return this;
    }

    withParams (params = {}) {
        this.requestData.params = params;
        return this;
    }

    withParam (key, value) {
        this.requestData.params[key] = value;
        return this;
    }

    withOptions (options = {}) {
        this.requestData.options = options;
        return this;
    }

    withOption (key, value) {
        this.requestData.options[key] = value;
        return this;
    }

    withHeaders (header = {}) {

        return this;
    }

    withHeader (key, value) {

        return this;
    }

    /**
     * Setters and Getters
     */

    get debug () {
        return this.config.debug;
    }

    set debug (val) {
        Logger.warn('debug mode must explcitly be turned on via the constructor in config.debug');
    }

    get collection () {
        this.currentRoute = 'collection';
        return this;
    }

    get model () {
        this.currentRoute = 'model';
        return this;
    }

    get any () {
        this.currentRoute = 'any';
        return this;
    }

    get routes () {
        return this.config.routes;
    }

    // set config (val) {
    //     console.log(val);
    //     // potentially loop through to set on model using setters
    //     // val.forEach((k, v) => {
    //     //     this[k] = v;
    //     // })
    //
    // }


    get baseURL () {
        return this.config.baseURL;
    }

    set baseURL (url) {
        this.config.baseURL = this.sanitizeUrl(url);
    }


    get primaryKey () {
        return this.config.primaryKey;
    }

    set primaryKey (val) {
        this.config.primaryKey = val;
    }


    get modelName () {
        return this.config.modelName;
    }

    set modelName (val) {
        this.config.modelName = val;
        this.setModelRoute();
        this.setCollectionRoute();
    }


    get routeDelimeter () {
        return this.config.routeDelimeter;
    }

    set routeDelimeter (val) {
        this.config.routeDelimeter = val;
        this.setModelRoute();
        this.setCollectionRoute();
    }


    get caseSensitive () {
        return this.config.caseSensitive;
    }

    set caseSensitive (val) {
        this.config.caseSensitive = val;
        this.setModelRoute();
        this.setCollectionRoute();
    }

    // functions to build a collection route for relationships
    setModelRoute () {
        let route = _kebabCase(this.config.modelName).replace(/-/g, this.config.routeDelimeter);

        if(this.config.caseSensitive) {
            route = this.config.modelName;
        }

        this.config.routes.model = route;
    }

    setCollectionRoute () {
        let route = _kebabCase(pluralize(this.config.modelName)).replace(/-/g, this.config.routeDelimeter);

        if(this.config.caseSensitive) {
            route = pluralize(this.config.modelName);
        }

        this.config.routes.collection = route;
    }
}

export default Rapid;
