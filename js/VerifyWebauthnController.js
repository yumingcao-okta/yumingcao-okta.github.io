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

/* eslint complexity:[2, 9] */

define([
  'okta',
  'util/FormController',
  'util/FormType',
  'util/CryptoUtil',
  'util/webauthn',
  'views/shared/FooterSignout',
  'vendor/lib/q',
  'util/FactorUtil',
  'views/mfa-verify/HtmlErrorMessageView'
],
function (Okta, FormController, FormType, CryptoUtil, webauthn, FooterSignout, Q, FactorUtil, HtmlErrorMessageView) {

  var _ = Okta._;

  return FormController.extend({
    className: 'mfa-verify verify-webauthn',
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
            factorType: 'webauthn',
            provider: 'FIDO'
          });

          var self = this;
          return factor.verify().then(function (transaction) {
            self.trigger('request');
            if (navigator.credentials.create == null) {
              var factorData = transaction.factor;
              var appId = factorData.challenge.extensions['appid'];
              var registeredKeys = [{version: 'U2F_V2', keyHandle: factorData.profile.credentialId }];
              self.trigger('request');

              var deferred = Q.defer();
              u2f.sign(appId, factorData.challenge.challenge, registeredKeys, function (data) {
                self.trigger('errors:clear');
                if (data.errorCode && data.errorCode !== 0) {
                  deferred.reject({xhr: {responseJSON: {errorSummary: 'error' + data.errorCode}}});
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
            } else {
              var options = _.extend({}, transaction.factor.challenge, {
                allowCredentials: [{
                  type: "public-key",
                  id: CryptoUtil.strToBin(transaction.factor.profile.credentialId)
                }],
                challenge: CryptoUtil.strToBin(transaction.factor.challenge.challenge)
              });

              return new Q(navigator.credentials.get({"publicKey": options}))
                .then(function (assertion) {
                  var rememberDevice = !!self.get('rememberDevice');
                  return factor.verify({
                    clientData: CryptoUtil.binToStr(assertion.response.clientDataJSON),
                    authenticatorData: CryptoUtil.binToStr(assertion.response.authenticatorData),
                    signatureData: CryptoUtil.binToStr(assertion.response.signature),
                    rememberDevice: rememberDevice
                  })
                })
                .fail(function (error) {
                  self.trigger('errors:clear');
                  throw {
                    xhr: {responseJSON: {errorSummary: error.message}}
                  };
                });
            }
          });
        });
      }
    },

    Form: {
      autoSave: true,
      hasSavingState: false,
      title: _.partial(Okta.loc, 'factor.u2f', 'login'),
      className: 'verify-webauthn-form',
      noCancelButton: true,
      save: _.partial(Okta.loc, 'verify.u2f.retry', 'login'),
      noButtonBar: function () {
        return !webauthn.isNewApiAvailable();
      },
      modelEvents: {
        'request': '_startEnrollment',
        'error': '_stopEnrollment'
      },

      formChildren: function () {
        var children = [];

        // TODO: handle non-webauthn browser flow
        if (webauthn.isNewApiAvailable()) {
          children.push(FormType.View({
            View: '\
            <div class="u2f-verify-text">\
              <p>{{i18n code="verify.u2f.instructions" bundle="login"}}</p>\
              <p>{{i18n code="verify.u2f.instructionsBluetooth" bundle="login"}}</p>\
              <div data-se="u2f-waiting" class="okta-waiting-spinner"></div>\
            </div>'
          }));
        }
        else {
          var errorMessageKey = 'u2f.error.factorNotSupported';
          if (this.options.appState.get('factors').length === 1) {
            errorMessageKey = 'u2f.error.factorNotSupported.oneFactor';
          }
          children.push(FormType.View(
              {View: new HtmlErrorMessageView({message: Okta.loc(errorMessageKey, 'login')})},
              {selector: '.o-form-error-container'}
          ));
        }

        if (this.options.appState.get('allowRememberDevice')) {
          children.push(FormType.Input({
            label: false,
            'label-top': true,
            placeholder: this.options.appState.get('rememberDeviceLabel'),
            className: 'margin-btm-0',
            name: 'rememberDevice',
            type: 'checkbox'
          }));
        }

        return children;
      },

      postRender: function () {
        _.defer(_.bind(function () {
          if (navigator.credentials.create != null) {
            this.model.save();
          }
          else {
            this.$('[data-se="u2f-waiting"]').hide();
          }
        }, this));
      },

      _startEnrollment: function () {
        this.$('.okta-waiting-spinner').show();
        this.$('.o-form-button-bar').hide();
      },

      _stopEnrollment: function () {
        this.$('.okta-waiting-spinner').hide();
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
