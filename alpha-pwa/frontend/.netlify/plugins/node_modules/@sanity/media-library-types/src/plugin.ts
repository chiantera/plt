import {Asset} from './assets'
import {FileUpload} from './files'

/**
 * Media Library capabilities that the consumer can declare it supports
 */
export type PluginCapabilities = {
  privateAssets?: boolean
}

/**
 * Filter that the plugin consumer can use to limit the assets shown
 */
export type PluginFilter = {
  type: 'groq'
  name: string
  query: string
}

/**
 * Asset types that can be selected by the plugin
 */
export type PluginSelectAssetType = 'file' | 'image' | 'video'

/**
 * Payload used to configure the plugin behavior
 */
export type PluginPayload = {
  auth: 'token' | 'cookie'
  capabilities?: PluginCapabilities
  disableNavigation?: boolean
  pluginFilters?: PluginFilter[]
  scheme: 'light' | 'dark'
  selectAssetTypes: PluginSelectAssetType[]
  selectionType: 'single' | 'multiple'
  /**
   * Opaque string the host generates to **partition persisted picker UI state** (e.g. folder path,
   * search query, filters) in the Media Library iframe. Huey derives `localStorage` key suffixes
   * from this value; embedders often derive it from project + dataset + workspace (or any stable
   * context).
   */
  pickerPersistenceKey?: string
}

/**
 * Message sent from the plugin when files are uploading
 */
export type PluginPostMessageUploadFilesProgress = {
  type: 'uploadProgress'
  files: FileUpload[]
}

/**
 * Message sent from the app that the pending uploads are uploaded
 */
export type PluginPostMessageUploadFilesResponse = {
  type: 'uploadResponse'
  assets: AssetSelectionItemWithLegacySupport[]
}

export interface AssetSelectionItem {
  asset: Asset
  assetInstanceId?: string | null
}

/* This is to support the legacy asset selection API in a transition phase */
interface AssetSelectionItemWithLegacySupport extends AssetSelectionItem {
  assetId: string
  assetType: string
  assetInstanceId: string // Required
}

export type PluginPostMessageAssetSelection = {
  type: 'assetSelection'
  selection: AssetSelectionItemWithLegacySupport[]
}

/**
 * Message sent from the plugin that a document has been updated
 */
export type PluginPostMessageDocumentUpdate = {
  type: 'documentUpdate'
  document: {_id: string; _type: string; _rev: string}
}

/**
 * Message sent from the plugin that the user wants to upload files
 */
export type PluginPostMessageUploadFilesRequest = {
  type: 'uploadRequest'
  files: {id: string; file: File}[]
}

export type PluginPostMessageAbortUploadRequest = {
  type: 'abortUploadRequest'
  files?: {id: string}[]
}

export type PluginPostMessageTokenRequest = {
  type: 'tokenRequest'
}

export type PluginPostMessageTokenResponse = {
  type: 'tokenResponse'
  token: string | null
}

/**
 * Message sent from a plugin page to notify the host that the page is loaded and ready to be interacted with
 */
export type PluginPostMessagePageLoaded = {
  type: 'pageLoaded'
  page: string
}

/**
 * Message sent from a plugin page that a page is unloaded by the user (for closing the dialog and similar)
 */
export type PluginPostMessagePageUnloaded = {
  type: 'pageUnloaded'
  page: string
}

export type PluginPostMessage =
  | PluginPostMessageAbortUploadRequest
  | PluginPostMessageAssetSelection
  | PluginPostMessageDocumentUpdate
  | PluginPostMessagePageLoaded
  | PluginPostMessagePageUnloaded
  | PluginPostMessageTokenRequest
  | PluginPostMessageTokenResponse
  | PluginPostMessageUploadFilesProgress
  | PluginPostMessageUploadFilesRequest
  | PluginPostMessageUploadFilesResponse
