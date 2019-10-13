import MediaProvider from './MediaProvider'
import FileTree from './FileTree'

export class ArchiveLoadError extends Error {
  constructor(path, archiveType, reason, missingFiles) {
    super("ArchiveLoadError: " + reason)
    this.path = path
    this.archiveType = archiveType
    this.reason = reason
    this.missingFiles = missingFiles
  }
}

export default async function parseArchive(path) {
  const dataFiles = [
    'account',
    'account-creation-ip',
    'account-suspension',
    'ad-engagements',
    'ad-impressions',
    'ad-mobile-conversions-attributed',
    'ad-mobile-conversions-unattributed',
    'ad-online-conversions-attributed',
    'ad-online-conversions-unattributed',
    'ageinfo',
    'block',
    'connected-application',
    'contact',
    'direct-message',
    'direct-message-headers',
    'direct-message-group',
    'email-address-change',
    'follower',
    'following',
    'ip-audit',
    'like',
    'lists-created',
    'lists-member',
    'lists-subscribed',
    'moment',
    'mute',
    'ni-devices',
    'personalization',
    'profile',
    'protected-history',
    'saved-search',
    'screen-name-change',
    'tweet',
    'verified',
  ]

  const tree = await FileTree.open(path)

  const list = await Promise.all(dataFiles.map(async (name) => {
    return {
      name,
      data: await tree.readTwitterJson(name + '.js')
    }
  }))

  const map = {}
  for (let entry of list) {
    map[entry.name] = (entry.data && entry.data[0] && entry.data[0][entry.name]) || entry.data
  }

  if (map.tweet) {
    for (let tweet of map.tweet) {
      tweet.created_date = new Date(tweet.created_at)
    }

    map.tweet.sort((a, b) => {
      return b.created_date - a.created_date
    })

    // Cross reference screen name data
    const screenNames = {}

    for (const tweet of map.tweet) {
      if (tweet.in_reply_to_user_id && tweet.in_reply_to_screen_name) {
        screenNames[tweet.in_reply_to_user_id] = tweet.in_reply_to_screen_name
      }
      if (tweet.entities.user_mentions) {
        for (const mention of tweet.entities.user_mentions) {
          if (mention.id_str && mention.screen_name) {
            screenNames[mention.id_str] = mention.screen_name
          }
        }
      }
    }

    map.screen_names = screenNames
  }

  map.tweet_media = new MediaProvider(await tree.readZip('tweet_media/tweet-media-part1.zip'))

  if (!map.account || !map.tweet) {
    const missingFiles = []
    for (const file of dataFiles) {
      if (map[file] === null) {
        missingFiles.push(file + '.js')
      }
    }
    throw new ArchiveLoadError(
      path,
      tree.type,
      'Critical files missing',
      missingFiles
    )
  }

  console.log('archive data', map)

  return map
}