/*!
 * Copyright (c) 2017, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

define(['okta'], function (Okta) {

  return Okta.View.extend({

    className: 'consent-beacon',
    template: '\
      <div class="logo-wrapper consent-beacon-user">\
        <div class="consent-beacon-border">\
          <span class="user-logo icon person-16-gray" />\
        </div>\
      </div>\
      <div class="arrows-wrapper">\
        <div class="arrow-left">\
          <span class="arrow icon arrow-right-16" />\
        </div>\
        <div class="arrow-right">\
          <span class="arrow icon arrow-left-16" />\
        </div>\
      </div>\
      <div class="logo-wrapper consent-beacon-client">\
        {{#if clientURI}}\
          <a href="{{clientURI}}" class="client-logo-link" target="_blank">\
        {{/if}}\
        <div class="consent-beacon-border"/>\
        {{#if clientURI}}\
          </a>\
        {{/if}}\
        {{#if customLogo}}\
          <img class="client-logo custom-logo" src="{{customLogo}}" />\
        {{else}}\
          <img class="client-logo default-logo" src="{{defaultLogo}}" />\
        {{/if}}\
      </div>\
    ',

    getTemplateData: function () {
      return {
        customLogo: this.options.appState.get('targetLogo') && this.options.appState.get('targetLogo').href,
        defaultLogo: this.options.appState.get('defaultAppLogo'),
        clientURI: this.options.appState.get('targetClientURI') && this.options.appState.get('targetClientURI').href
      };
    },

    equals: function (Beacon) {
      return Beacon && this instanceof Beacon;
    }

  });
});
