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

define([
  'okta',
  'util/FormType',
  'util/FormController',
  'util/CryptoUtil',
  'util/webauthn',
  'views/enroll-factors/Footer',
  'vendor/lib/q',
  'views/mfa-verify/HtmlErrorMessageView'
],
function (Okta, FormType, FormController, CryptoUtil, webauthn, Footer, Q, HtmlErrorMessageView) {

  var _ = Okta._;

  return FormController.extend({
    className: 'enroll-webauthn',
    Model: {
      local: {
        '__enrolled__': 'boolean'
      },

      save: function () {
        this.trigger('request');

        if (this.get('__enrolled__')) {
          return this.activate();
        }

        return this.doTransaction(function (transaction) {
          var factor = _.findWhere(transaction.factors, {
            factorType: 'webauthn',
            provider: 'FIDO'
          });
          return factor.enroll();
        });
      },

      activate: function () {
        this.set('__enrolled__', true);
        this.trigger('errors:clear');

        return this.doTransaction(function (transaction) {
          if (navigator.credentials.create == null) {
            var activation = transaction.factor.activation;
            var appId = 'https://yumingcao-okta.github.io';
            var registerRequests = [{
              version: 'U2F_V2',
              challenge: activation.challenge
            }];
            var self = this;
            var deferred = Q.defer();
            u2f.register(appId, registerRequests, [], function (data) {
              self.trigger('errors:clear');
              if (data.errorCode && data.errorCode !== 0) {
                deferred.reject({
                  xhr: { responseJSON: { errorSummary: 'data.errorCode: ' + data.errorCode } }
                });
              } else {
                deferred.resolve(transaction.activate({
                  attestation: data.registrationData,
                  clientData: data.clientData
                }));
              }
            });
            return deferred.promise;
          } else {
            var activation = transaction.factor.activation;
            var options = _.extend({}, activation, {
              challenge: CryptoUtil.strToBin(activation.challenge),
              user: {
                id: CryptoUtil.strToBin(activation.user.id),
                name: activation.user.name,
                displayName: activation.user.displayName
              }
            });

            return new Q(navigator.credentials.create({publicKey: options}))
              .then(function (newCredential) {
                return transaction.activate({
                  attestation: CryptoUtil.binToStr(newCredential.response.attestationObject),
                  clientData: CryptoUtil.binToStr(newCredential.response.clientDataJSON)
                });
              })
              .fail(function (error) {
                throw {
                  xhr: {responseJSON: {errorSummary: error.message}}
                };
              });
          }
        });
      }
    },

    Form: {
      title: _.partial(Okta.loc, 'enroll.u2f.title', 'login'),
      save: _.partial(Okta.loc, 'enroll.u2f.save', 'login'),
      noCancelButton: true,
      hasSavingState: false,
      autoSave: true,
      className: 'enroll-webauthn-form',
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
          //There is html in enroll.u2f.general2 in our properties file, reason why is unescaped
          children.push(FormType.View({
            View:
              '<div class="u2f-instructions">\
                 <ol>\
                   <li>{{{i18n code="enroll.u2f.general2" bundle="login"}}}</li>\
                   <li>{{i18n code="enroll.u2f.general3" bundle="login"}}</li>\
                 </ol>\
               </div>\
               <div class="u2f-enroll-text hide">\
                 <p>{{i18n code="enroll.u2f.instructions" bundle="login"}}</p>\
                 <p>{{i18n code="enroll.u2f.instructionsBluetooth" bundle="login"}}</p>\
                 <div data-se="u2f-devices" class="u2f-devices-images">\
                   <div class="u2f-usb"></div>\
                   <div class="u2f-bluetooth"></div>\
                 </div>\
                 <div data-se="u2f-waiting" class="okta-waiting-spinner"></div>\
               </div>'
          }));
        } else {
          var errorMessageKey = 'u2f.error.factorNotSupported';
          if (this.options.appState.get('factors').length === 1) {
            errorMessageKey = 'u2f.error.factorNotSupported.oneFactor';
          }
          children.push(FormType.View(
              {View: new HtmlErrorMessageView({message: Okta.loc(errorMessageKey, 'login')})},
              {selector: '.o-form-error-container'}
          ));
        }

        return children;
      },

      _startEnrollment: function () {
        this.$('.u2f-instructions').addClass('hide');
        this.$('.u2f-enroll-text').removeClass('hide');
        this.$('.o-form-button-bar').hide();
      },

      _stopEnrollment: function () {
        this.$('.u2f-instructions').removeClass('hide');
        this.$('.u2f-enroll-text').addClass('hide');
        this.$('.o-form-button-bar').show();
      }
    },

    Footer: Footer,

    trapAuthResponse: function () {
      if (this.options.appState.get('isMfaEnrollActivate')) {
        this.model.activate();
        return true;
      }
    }
  });

});
