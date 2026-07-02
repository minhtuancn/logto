import {
  hookProvisioningProfileGuard,
  inlineHookLogtoConfigNamespaceKey,
  type HookProvisioningProfile,
  type InlineHookLogtoConfig,
  type JsonObject,
  type User,
} from '@logto/schemas';

export const toHookProvisioningProfile = (user: unknown): HookProvisioningProfile =>
  hookProvisioningProfileGuard.parse(user);

type HookProvisioningProfileWithMergedUserData = Omit<
  HookProvisioningProfile,
  'customData' | 'logtoConfig'
> &
  Partial<Pick<User, 'customData' | 'logtoConfig'>>;

const hasCustomDataPatch = (customData: JsonObject | undefined): customData is JsonObject =>
  customData !== undefined && Object.keys(customData).length > 0;

const hasInlineHookLogtoConfig = (
  logtoConfig: InlineHookLogtoConfig | undefined
): logtoConfig is Required<InlineHookLogtoConfig> =>
  logtoConfig?.[inlineHookLogtoConfigNamespaceKey] !== undefined;

export const mergeCustomData = (existingData: JsonObject, customData?: JsonObject): JsonObject =>
  hasCustomDataPatch(customData)
    ? {
        ...existingData,
        ...customData,
      }
    : existingData;

export const mergeInlineHookLogtoConfig = (
  existingLogtoConfig: JsonObject,
  logtoConfig: InlineHookLogtoConfig | undefined
): JsonObject =>
  hasInlineHookLogtoConfig(logtoConfig)
    ? {
        ...existingLogtoConfig,
        [inlineHookLogtoConfigNamespaceKey]: logtoConfig[inlineHookLogtoConfigNamespaceKey],
      }
    : existingLogtoConfig;

export const mergeInlineHookProvisioningProfileUserData = (
  existingUserData: Pick<User, 'customData' | 'logtoConfig'>,
  provisioningProfile: HookProvisioningProfile
): HookProvisioningProfileWithMergedUserData => {
  const { customData, logtoConfig, ...profile } = provisioningProfile;

  return {
    ...profile,
    ...(hasCustomDataPatch(customData) && {
      customData: mergeCustomData(existingUserData.customData, customData),
    }),
    ...(hasInlineHookLogtoConfig(logtoConfig) && {
      logtoConfig: mergeInlineHookLogtoConfig(existingUserData.logtoConfig, logtoConfig),
    }),
  };
};
