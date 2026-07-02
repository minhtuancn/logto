import {
  UsersPasswordEncryptionMethod,
  userMfaDataKey,
  userPasskeySignInDataKey,
} from '@logto/schemas';
import { ZodError } from 'zod';

import {
  mergeCustomData,
  mergeInlineHookProvisioningProfileUserData,
  mergeInlineHookLogtoConfig,
  toHookProvisioningProfile,
} from './inline-hook-provisioning-profile.js';

describe('toHookProvisioningProfile', () => {
  it('returns the hook provisioning profile with whitelisted fields', () => {
    const provisioningProfile = toHookProvisioningProfile({
      name: 'Jane Doe',
      avatar: 'https://example.com/avatar.png',
      username: 'jane',
      primaryEmail: 'jane@example.com',
      primaryPhone: '+1234567890',
      profile: {
        givenName: 'Jane',
        familyName: 'Doe',
      },
      customData: {
        plan: 'pro',
        upstreamId: 'user-1',
      },
      logtoConfig: {
        inlineHook: {
          acceptedTerms: true,
        },
      },
      passwordEncrypted: 'hashed-password',
      passwordEncryptionMethod: UsersPasswordEncryptionMethod.Argon2i,
    });

    expect(provisioningProfile).toEqual({
      name: 'Jane Doe',
      avatar: 'https://example.com/avatar.png',
      username: 'jane',
      primaryEmail: 'jane@example.com',
      primaryPhone: '+1234567890',
      profile: {
        givenName: 'Jane',
        familyName: 'Doe',
      },
      customData: {
        plan: 'pro',
        upstreamId: 'user-1',
      },
      logtoConfig: {
        inlineHook: {
          acceptedTerms: true,
        },
      },
      passwordEncrypted: 'hashed-password',
      passwordEncryptionMethod: UsersPasswordEncryptionMethod.Argon2i,
    });
  });

  it('rejects non-whitelisted top-level user fields', () => {
    expect(() =>
      toHookProvisioningProfile({
        id: 'user-id',
        applicationId: 'application-id',
        isSuspended: true,
        isPasswordExpired: true,
        identities: {},
        mfaVerifications: [],
        lastSignInAt: Date.now(),
        passwordDigest: 'password-digest',
        passwordAlgorithm: UsersPasswordEncryptionMethod.Argon2i,
      })
    ).toThrow(ZodError);
  });

  it('validates the profile field with userProfileGuard', () => {
    expect(() =>
      toHookProvisioningProfile({
        profile: {
          givenName: 1,
        },
      })
    ).toThrow(ZodError);
  });

  it('allows arbitrary customData without the inlineHook namespace', () => {
    expect(
      toHookProvisioningProfile({
        customData: {
          plan: 'pro',
          inlineHook: true,
        },
      })
    ).toEqual({
      customData: {
        plan: 'pro',
        inlineHook: true,
      },
    });
  });

  it('rejects logtoConfig writes outside the inlineHook namespace', () => {
    expect(() =>
      toHookProvisioningProfile({
        logtoConfig: {
          theme: 'dark',
        },
      })
    ).toThrow(ZodError);
  });

  it('rejects reserved internal logtoConfig keys', () => {
    expect(() =>
      toHookProvisioningProfile({
        logtoConfig: {
          [userMfaDataKey]: {
            enabled: true,
          },
        },
      })
    ).toThrow(ZodError);

    expect(() =>
      toHookProvisioningProfile({
        logtoConfig: {
          [userPasskeySignInDataKey]: {
            skipped: true,
          },
        },
      })
    ).toThrow(ZodError);
  });

  it('requires logtoConfig.inlineHook data to be an object', () => {
    expect(() =>
      toHookProvisioningProfile({
        logtoConfig: {
          inlineHook: null,
        },
      })
    ).toThrow(ZodError);
  });

  it('requires password fields to be provided together', () => {
    expect(() =>
      toHookProvisioningProfile({
        passwordEncrypted: 'hashed-password',
      })
    ).toThrow(ZodError);

    expect(() =>
      toHookProvisioningProfile({
        passwordEncryptionMethod: UsersPasswordEncryptionMethod.Argon2i,
      })
    ).toThrow(ZodError);
  });
});

describe('mergeCustomData', () => {
  it('shallow-merges customData into existing data', () => {
    expect(
      mergeCustomData(
        {
          source: 'registration',
          plan: 'free',
        },
        {
          plan: 'pro',
          upstreamId: 'user-1',
        }
      )
    ).toEqual({
      source: 'registration',
      plan: 'pro',
      upstreamId: 'user-1',
    });
  });

  it('returns existing data when customData is missing or empty', () => {
    const existingData = {
      source: 'registration',
    };

    expect(mergeCustomData(existingData)).toBe(existingData);
    expect(mergeCustomData(existingData, {})).toBe(existingData);
  });
});

describe('mergeInlineHookLogtoConfig', () => {
  it('merges only the inlineHook namespace into existing logtoConfig', () => {
    expect(
      mergeInlineHookLogtoConfig(
        {
          [userMfaDataKey]: {
            enabled: true,
          },
          inlineHook: {
            oldFlag: true,
          },
        },
        {
          inlineHook: {
            acceptedTerms: true,
          },
        }
      )
    ).toEqual({
      [userMfaDataKey]: {
        enabled: true,
      },
      inlineHook: {
        acceptedTerms: true,
      },
    });
  });

  it('returns existing logtoConfig when hook data does not include inlineHook', () => {
    const existingData = {
      source: 'registration',
    };

    expect(mergeInlineHookLogtoConfig(existingData, {})).toBe(existingData);
  });
});

describe('mergeInlineHookProvisioningProfileUserData', () => {
  it('shallow-merges customData and only merges logtoConfig.inlineHook', () => {
    const mergedProfile = mergeInlineHookProvisioningProfileUserData(
      {
        customData: {
          source: 'registration',
          plan: 'free',
        },
        logtoConfig: {
          [userMfaDataKey]: {
            enabled: true,
          },
          [userPasskeySignInDataKey]: {
            skipped: true,
          },
          inlineHook: {
            oldFlag: true,
          },
        },
      },
      {
        name: 'Jane Doe',
        customData: {
          plan: 'pro',
          upstreamId: 'user-1',
        },
        logtoConfig: {
          inlineHook: {
            acceptedTerms: true,
          },
        },
      }
    );

    expect(mergedProfile).toEqual({
      name: 'Jane Doe',
      customData: {
        source: 'registration',
        plan: 'pro',
        upstreamId: 'user-1',
      },
      logtoConfig: {
        [userMfaDataKey]: {
          enabled: true,
        },
        [userPasskeySignInDataKey]: {
          skipped: true,
        },
        inlineHook: {
          acceptedTerms: true,
        },
      },
    });
  });

  it('leaves user data fields out when hook data has no effective patch', () => {
    const mergedProfile = mergeInlineHookProvisioningProfileUserData(
      {
        customData: {
          source: 'registration',
        },
        logtoConfig: {
          [userMfaDataKey]: {
            enabled: true,
          },
        },
      },
      {
        username: 'jane',
        customData: {},
        logtoConfig: {},
      }
    );

    expect(mergedProfile).toEqual({
      username: 'jane',
    });
  });
});
