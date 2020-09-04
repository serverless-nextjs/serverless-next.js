// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Minified unfetch here for better performance
const getFetchPolyfill = () => {
  return '!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?module.exports=n():"function"==typeof define&&define.amd?define(n):e.unfetch=n()}(this,function(){return function(e,n){return n=n||{},new Promise(function(t,o){var r=new XMLHttpRequest,s=[],u=[],i={},f=function(){return{ok:2==(r.status/100|0),statusText:r.statusText,status:r.status,url:r.responseURL,text:function(){return Promise.resolve(r.responseText)},json:function(){return Promise.resolve(JSON.parse(r.responseText))},blob:function(){return Promise.resolve(new Blob([r.response]))},clone:f,headers:{keys:function(){return s},entries:function(){return u},get:function(e){return i[e.toLowerCase()]},has:function(e){return e.toLowerCase()in i}}}};for(var a in r.open(n.method||"get",e,!0),r.onload=function(){r.getAllResponseHeaders().replace(/^(.*?):[^\\S\\n]*([\\s\\S]*?)$/gm,function(e,n,t){s.push(n=n.toLowerCase()),u.push([n,t]),i[n]=i[n]?i[n]+","+t:t}),t(f())},r.onerror=o,r.withCredentials="include"==n.credentials,n.headers)r.setRequestHeader(a,n.headers[a]);r.send(n.body||null)})}});//# sourceMappingURL=unfetch.umd.js.map';
};

// Polyfill fetch with unfetch (XHR), so we can spy on these requests in Cypress
Cypress.Commands.overwrite("visit", (originalFn, url, options) => {
  const polyfill = !(window as any).fetchPoly && getFetchPolyfill();

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const opts = (<any>Object).assign({}, options, {
    onBeforeLoad: (window, ...args) => {
      if (!window.fetchPoly) {
        delete window.fetch;
        window.eval(polyfill);
        window.fetchPoly = true;
        window.fetch = window.unfetch;
      }

      if (options && options.onBeforeLoad) {
        return options.onBeforeLoad(window, ...args);
      }
    }
  });

  return originalFn(url, opts);
});

import "./commands";
