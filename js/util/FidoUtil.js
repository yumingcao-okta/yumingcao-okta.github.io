define(function () {
  var fn = {};

  fn.getU2fEnrollErrorMessageKeyByCode = function (errorCode) {
    switch (errorCode) {
      default:
      case 1:
        return 'u2f.error.other';
      case 2:
      case 3:
        return 'u2f.error.badRequest';
      case 4:
        return 'u2f.error.unsupported';
      case 5:
        return 'u2f.error.timeout';
    }
  };

  fn.getU2fVerifyErrorMessageKeyByCode = function (errorCode, isOneFactor) {
    switch (errorCode){
      case 1: // OTHER_ERROR
        return isOneFactor ? 'u2f.error.other.oneFactor' : 'u2f.error.other';
      case 2: // BAD_REQUEST
      case 3: // CONFIGURATION_UNSUPPORTED
        return isOneFactor ? 'u2f.error.badRequest.oneFactor' : 'u2f.error.badRequest';
      case 4: // DEVICE_INELIGIBLE
        return isOneFactor ? 'u2f.error.unsupported.oneFactor' : 'u2f.error.unsupported';
      case 5: // TIMEOUT
        return 'u2f.error.timeout';
    }
  };

  fn.getU2fVersion = function () {
    return 'U2F_V2';
  };

  fn.getAppId = function () {
    return location.origin;
  };

  return fn;
});
