import {
  SanityAsset,
  SanityAssetCollection,
  SanityAssetVersion,
  SanityVideoAsset,
  SanityFileAsset,
  SanityImageAsset,
} from './schema.types'
import {type FieldDefinition} from '@sanity/types'

export type {
  SanityVideoAsset,
  SanityAssetUploadSession as UploadSession,
  SanityVideoMetadataRendition,
} from './schema.types'

export interface AssetVersion<AssetInstance extends AssetInstanceDocument = AssetInstanceDocument> {
  _key: string
  _type: SanityAssetVersion['_type']
  title?: string
  instance: AssetInstance
}

export type AssetInstanceDocument = SanityImageAsset | SanityVideoAsset | SanityFileAsset

export interface Asset<AssetInstance extends AssetInstanceDocument = AssetInstanceDocument> {
  _id: string
  _originalId?: string
  _type: SanityAsset['_type']
  title: string
  assetType: AssetInstance['_type']
  cdnAccessPolicy: SanityAsset['cdnAccessPolicy']
  currentVersion: {
    _ref: string
  }
  aspects?: unknown
  versions: AssetVersion<AssetInstance>[]
  collections: SanityAssetCollection[]
  _createdAt: string
  _updatedAt: string
  _rev: string
  url?: string
}

export type BaseDocument = {
  _id: string
  _type: string
  _rev: string
  _createdAt: string
  _updatedAt: string
  [key: string]: any
}

export interface AssetAspectDocument extends BaseDocument {
  _type: 'sanity.asset.aspect'
  /**
   * The asset type this aspect definition applies to
   * Undefined means that it applies to all asset types
   */
  assetType?: Asset['assetType']
  definition: FieldDefinition
  public?: boolean
}
