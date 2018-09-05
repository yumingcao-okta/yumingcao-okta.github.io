/*!
 * Copyright (c) 2015-2016, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

/* global u2f */
/* eslint complexity:[2, 9] */

define([
  'okta',
  'util/FormController',
  'util/FormType',
  'views/shared/FooterSignout',
  'vendor/lib/q',
  'util/FactorUtil',
  'util/FidoUtil',
  'views/mfa-verify/HtmlErrorMessageView',
  'u2f-api-polyfill'
],
function (Okta, FormController, FormType, FooterSignout, Q, FactorUtil, FidoUtil, HtmlErrorMessageView) {

  var _ = Okta._;

  return FormController.extend({
    className: 'mfa-verify verify-u2f',
    Model: {
      props: {
        rememberDevice: 'boolean'
      },

      initialize: function () {
        var rememberDevice = FactorUtil.getRememberDeviceValue(this.appState);
        // set the initial value for remember device (Cannot do this while defining the
        // local property because this.settings would not be initialized there yet).
        this.set('rememberDevice', rememberDevice);
      },

      save: function () {
        this.trigger('request');

        return this.doTransaction(function (transaction) {
          var factor = _.findWhere(transaction.factors, {
            factorType: 'u2f',
            provider: 'FIDO'
          });
          var self = this;
          return factor.verify()
          .then(function (transaction) {
            var factorData = transaction.factor;
            var appId = factorData.profile.appId;
            var registeredKeys = [{version: factorData.profile.version, keyHandle: factorData.profile.credentialId }];
            self.trigger('request');

            var deferred = Q.defer();
            u2f.sign(appId, factorData.challenge.nonce, registeredKeys, function (data) {
              self.trigger('errors:clear');
              if (data.errorCode && data.errorCode !== 0) {
                var isOneFactor = self.options.appState.get('factors').length === 1;
                deferred.reject({xhr: {responseJSON:
                  {errorSummary: Okta.loc(FidoUtil.getU2fVerifyErrorMessageKeyByCode(data.errorCode, isOneFactor), 'login')}}});
              } else {
                var rememberDevice = !!self.get('rememberDevice');
                return factor.verify({
                  clientData: data.clientData,
                  signatureData: data.signatureData,
                  rememberDevice: rememberDevice
                })
                .then(deferred.resolve);
              }
            });
            return deferred.promise;
          });
        });
      }
    },

    Form: {
      autoSave: true,
      hasSavingState: false,
      title: _.partial(Okta.loc, 'factor.u2f', 'login'),
      className: 'verify-u2f-form',
      noCancelButton: true,
      save: _.partial(Okta.loc, 'verify.u2f.retry', 'login'),
      noButtonBar: function () {
        return !window.hasOwnProperty('u2f');
      },
      modelEvents: {
        'request': '_startEnrollment',
        'error': '_stopEnrollment'
      },

      formChildren: function () {
        var result = [];

        if (!window.hasOwnProperty('u2f')) {
          var errorMessageKey = 'u2f.error.factorNotSupported';
          if (this.options.appState.get('factors').length === 1) {
            errorMessageKey = 'u2f.error.factorNotSupported.oneFactor';
          }
          result.push(FormType.View(
            {View: new HtmlErrorMessageView({message: Okta.loc(errorMessageKey, 'login')})},
            {selector: '.o-form-error-container'}
          ));
        }
        else {
          result.push(FormType.View({
            View: '\
            <div class="u2f-verify-text">\
              <p>{{i18n code="verify.u2f.instructions" bundle="login"}}</p>\
              <p>{{i18n code="verify.u2f.instructionsBluetooth" bundle="login"}}</p>\
              <div data-se="u2f-waiting" class="okta-waiting-spinner"></div>\
            </div>'
          }));
        }

        if (this.options.appState.get('allowRememberDevice')) {
          result.push(FormType.Input({
            label: false,
            'label-top': true,
            placeholder: this.options.appState.get('rememberDeviceLabel'),
            className: 'margin-btm-0',
            name: 'rememberDevice',
            type: 'checkbox'
          }));
        }

        return result;
      },

      postRender: function () {
        _.defer(_.bind(function () {
          if (window.hasOwnProperty('u2f')) {
            this.model.save();
          }
          else {
            this.$('[data-se="u2f-waiting"]').addClass('hide');
          }
        }, this));
      },

      _startEnrollment: function () {
        this.$('.okta-waiting-spinner').removeClass('hide');
        this.$('.o-form-button-bar').hide();
      },

      _stopEnrollment: function () {
        this.$('.okta-waiting-spinner').addClass('hide');
        this.$('.o-form-button-bar').show();
      }
    },

    back: function() {
      // Empty function on verify controllers to prevent users
      // from navigating back during 'verify' using the browser's
      // back button. The URL will still change, but the view will not
      // More details in OKTA-135060.
    },

    Footer: FooterSignout
  });

});
