# Microsoft Social Engagement (MSE) - Reconstructed Data Model

> **Status**: Discontinued (2018) - Replaced by Dynamics 365 Customer Insights
> **Version**: Based on Dynamics 365 Customer Engagement (on-premises) v9.1

---

## Table of Contents

- [Overview](#overview)
- [Core Entities](#core-entities)
  - [SocialActivity Entity](#socialactivity-entity)
  - [SocialProfile Entity](#socialprofile-entity)
- [Entity Relationships](#entity-relationships)
- [Extended Components](#extended-components)
- [Data Flow Architecture](#data-flow-architecture)
- [Simplified ER Diagram](#simplified-er-diagram)
- [JSON Payload Examples](#json-payload-examples)
- [Limitations and Notes](#limitations-and-notes)
- [Comparison with Modern Equivalents](#comparison-with-modern-equivalents)

---

## Overview

Microsoft Social Engagement (MSE) was a social media monitoring and analytics solution integrated with Dynamics 365 Customer Engagement. It provided organizations with the ability to:

- Monitor social media channels (Twitter, Facebook, etc.)
- Track brand mentions, hashtags, and keywords
- Analyze sentiment and trends
- Route social posts to appropriate teams
- Automatically create CRM cases from social activity
- Enrich customer profiles with social data

The application was **discontinued in 2018** and replaced by Dynamics 365 Social Insights and later Dynamics 365 Customer Insights.

---

## Core Entities

### SocialActivity Entity

**Purpose**: Track individual social media posts/messages from various channels.

**Entity Metadata:**
- **Schema Name**: `socialactivity`
- **Display Name**: Social Activity
- **Collection Schema Name**: `SocialActivities`
- **Entity Set Name**: `socialactivities`
- **Primary ID Attribute**: `activityid`
- **Primary Name Attribute**: `subject`
- **Table Type**: Standard
- **Ownership Type**: UserOwned

#### Key Fields

| Field | Schema Name | Type | Required | Description |
|-------|-------------|------|----------|-------------|
| Activity | `activityid` | Uniqueidentifier | SystemRequired | Primary key |
| Subject | `subject` | String | No | Post subject/content summary (Max: 200 chars) |
| Description | `description` | Memo | No | Full post content (Max: 2000 chars) |
| Post ID | `postid` | String | No | Social network's native post ID (Max: 160 chars) |
| Post URL | `posturl` | URL | No | Link to the original post (Max: 200 chars) |
| Posted On | `postedon` | DateTime | No | When the post was created |
| Social Channel | `community` | Picklist | No | Source channel (0=Other, 1=Twitter, 2=Facebook) |
| Received As | `postmessagetype` | Picklist | No | Public Message (0) or Private Message (1) |
| Direction | `directioncode` | Boolean | No | Incoming (False) or Outgoing (True) |
| Sentiment Value | `sentimentvalue` | Double | No | Numeric sentiment score (-100000000000 to +100000000000, Precision: 2) |
| Priority | `prioritycode` | Picklist | No | Low (0), Normal (1), High (2) |
| Status | `statecode` | State | SystemRequired | Open (0), Completed (1), Canceled (2) |
| Status Reason | `statuscode` | Status | No | Processing (3), Open (4), Completed (1), Failed (2), Canceled (5) |
| Post Author | `postauthor` | Customer | No | Linked account/contact who authored |
| Post Author Account | `postauthoraccount` | Customer | ApplicationRequired | Parent account of the author |
| Post Author Type | `postauthortype` | EntityName | No | Parent account or parent contact for post author |
| Posted By | `postfromprofileid` | Lookup → SocialProfile | No | Author's social profile |
| Post To | `posttoprofileid` | String | No | Recipients of the social post (Max: 200 chars) |
| Regarding | `regardingobjectid` | Lookup | No | Related CRM record (Account, Contact, Case, etc.) |
| In Response To | `inresponseto` | String | No | ID of parent post (for replies/threads) (Max: 160 chars) |
| Thread ID | `threadid` | String | No | Conversation thread identifier (Max: 160 chars) |
| Social Additional Params | `socialadditionalparams` | Memo | No | JSON payload with extra social data (Max: 8192 chars) |
| Activity Additional Params | `activityadditionalparams` | Memo | No | For internal use only (Max: 8192 chars) |

#### Read-Only Fields

| Field | Schema Name | Type | Description |
|-------|-------------|------|-------------|
| Activity Type | `activitytypecode` | EntityName | Type of activity |
| Created By | `createdby` | Lookup → systemuser | User who created the activity |
| Created On | `createdon` | DateTime | Date and time when created |
| Modified By | `modifiedby` | Lookup → systemuser | User who last modified |
| Modified On | `modifiedon` | DateTime | Date and time of last modification |
| Owner | `ownerid` | Owner | User or team who owns the activity |
| Owning Business Unit | `owningbusinessunit` | Lookup → businessunit | Business unit that owns the activity |
| Owning Team | `owningteam` | Lookup → team | Team that owns the activity |
| Owning User | `owninguser` | Lookup → systemuser | User who owns the activity |

---

### SocialProfile Entity

**Purpose**: Store social media user/profile information.

**Entity Metadata:**
- **Schema Name**: `socialprofile`
- **Display Name**: Social Profile
- **Collection Schema Name**: `SocialProfiles`
- **Entity Set Name**: `socialprofiles`
- **Primary ID Attribute**: `socialprofileid`

#### Key Fields

| Field | Schema Name | Type | Required | Description |
|-------|-------------|------|----------|-------------|
| Social Profile | `socialprofileid` | Uniqueidentifier | SystemRequired | Primary key |
| Profile ID | `profileid` | String | No | Unique ID from social network |
| Profile Name | `profilename` | String | No | Profile display name |
| Social Channel | `community` | Picklist | No | Social channel (0=Other, 1=Twitter, 2=Facebook) |
| Profile URL | `profileurl` | URL | No | Link to the social profile |
| Followers Count | `followerscount` | Integer | No | Number of followers |
| Following Count | `followingcount` | Integer | No | Number following |
| Post Count | `postcount` | Integer | No | Total posts from this profile |
| Profile Image | `profileimage` | String | No | URL to profile picture |
| Last Posted On | `lastpostedon` | DateTime | No | Last activity date |
| Social Additional Params | `socialadditionalparams` | Memo | No | JSON with extended profile data |
| Regarding | `regardingobjectid` | Lookup | No | Linked CRM Contact/Account |

---

## Entity Relationships

### Many-to-One Relationships (SocialActivity)

SocialActivity has the following many-to-one relationships with other entities:

| Relationship Name | Referenced Entity | Referenced Attribute | Referencing Attribute | Description |
|-------------------|-------------------|---------------------|----------------------|-------------|
| Account_SocialActivities | account | accountid | regardingobjectid | Links to related Account |
| Contact_SocialActivities | contact | contactid | regardingobjectid | Links to related Contact |
| SocialActivity_PostAuthor_accounts | account | accountid | postauthor | Author account |
| socialactivity_postauthor_contacts | contact | contactid | postauthor | Author contact |
| SocialActivity_PostAuthorAccount_accounts | account | accountid | postauthoraccount | Parent account of author |
| socialactivity_postauthoraccount_contacts | contact | contactid | postauthoraccount | Parent contact of author |
| Socialprofile_SocialActivities | socialprofile | socialprofileid | postfromprofileid | Author's social profile |
| business_unit_socialactivity | businessunit | businessunitid | owningbusinessunit | Owning business unit |
| team_socialactivity | team | teamid | owningteam | Owning team |
| user_socialactivity | systemuser | systemuserid | owninguser | Owning user |
| sla_socialactivity | sla | slaid | slainvokedid | Applied SLA |
| transactioncurrency_socialactivity | transactioncurrency | transactioncurrencyid | transactioncurrencyid | Currency |
| activity_pointer_socialactivity | activitypointer | activityid | activityid | Activity pointer |

### One-to-Many Relationships (SocialActivity)

| Relationship Name | Referencing Entity | Referencing Attribute | Description |
|-------------------|--------------------|----------------------|-------------|
| socialactivity_activity_parties | activityparty | activityid | Activity participants |
| SocialActivity_Annotation | annotation | objectid | Attachments/notes |
| SocialActivity_AsyncOperations | asyncoperation | regardingobjectid | Async operations |
| SocialActivity_BulkDeleteFailures | bulkdeletefailure | regardingobjectid | Bulk delete failures |
| socialactivity_connections1 | connection | record1id | Connection (record 1) |
| socialactivity_connections2 | connection | record2id | Connection (record 2) |
| SocialActivity_DuplicateBaseRecord | duplicaterecord | baserecordid | Duplicate detection |
| SocialActivity_DuplicateMatchingRecord | duplicaterecord | duplicaterecordid | Duplicate matching |
| socialactivity_principalobjectattributeaccess | principalobjectattributeaccess | objectid | Security access |
| SocialActivity_ProcessSessions | processsession | regardingobjectid | Process sessions |
| SocialActivity_QueueItem | queueitem | objectid | Queue items for routing |
| SocialActivity_SyncErrors | syncerror | regardingobjectid | Sync errors |
| slakpiinstance_socialactivity | slakpiinstance | regarding | SLA KPI instance |

### Many-to-One Relationships (SocialProfile)

| Relationship Name | Referenced Entity | Referenced Attribute | Referencing Attribute | Description |
|-------------------|-------------------|---------------------|----------------------|-------------|
| Account_SocialProfiles | account | accountid | regardingobjectid | Linked Account |
| Contact_SocialProfiles | contact | contactid | regardingobjectid | Linked Contact |
| business_unit_socialprofile | businessunit | businessunitid | owningbusinessunit | Owning business unit |
| team_socialprofile | team | teamid | owningteam | Owning team |
| user_socialprofile | systemuser | systemuserid | owninguser | Owning user |

---

## Extended Components

### 1. Alerts & Watch Lists

- **Keyword-based monitoring** with boolean logic
- **Hashtag tracking** (#tags)
- **Mention tracking** (@mentions)
- **Geographic filtering** (latitude/longitude)
- **Sentiment thresholds** for automated alerts

### 2. Analytics & Dashboards

- **Post volume trends** (time-series aggregation)
- **Sentiment analysis** (aggregated scores across posts)
- **Top influencers** (ranked by follower count, engagement rate)
- **Share of voice** metrics
- **Response time tracking** (time to first response)

### 3. Case Integration

- **Automated case creation** from social posts based on rules
- **Rule-driven routing** to queues/teams
- **Case-SocialActivity linking** via `regardingobjectid`
- **SLA tracking** for response time compliance

---

## Data Flow Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Social Media  │────▶│  MSE Connector  │────▶│ SocialActivity  │
│   (Twitter, FB) │     │   (Data Feed)   │     │   (Post Data)   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                          ┌───────────────────────────────┼───────────────────────────────┐
                          │                               │                               │
                          ▼                               ▼                               ▼
                ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
                │ SocialProfile   │           │     Account      │           │      Contact     │
                │ (User Data)     │           │ (Company)       │           │ (Person)        │
                └─────────────────┘           └─────────────────┘           └─────────────────┘
                          │                               │
                          └───────────────────┬───────────┘
                                          │
                                          ▼
                                ┌─────────────────┐
                                │     Analytics    │
                                │   (Aggregated)   │
                                └─────────────────┘
```

---

## Simplified ER Diagram

```
SOCIALPROFILE
├── socialprofileid (PK, Uniqueidentifier)
├── profileid (String)
├── profilename (String)
├── community (Picklist: 0=Other, 1=Twitter, 2=Facebook)
├── profileurl (URL)
├── followerscount (Integer)
├── followingcount (Integer)
├── postcount (Integer)
├── profileimage (String)
├── lastpostedon (DateTime)
├── regardingobjectid (Lookup → ACCOUNT/CONTACT)
└── socialadditionalparams (Memo, JSON)

SOCIALACTIVITY
├── activityid (PK, Uniqueidentifier)
├── subject (String, 200)
├── description (Memo, 2000)
├── postid (String, 160)
├── posturl (URL, 200)
├── postedon (DateTime)
├── community (Picklist: 0=Other, 1=Twitter, 2=Facebook)
├── postmessagetype (Picklist: 0=Public, 1=Private)
├── directioncode (Boolean: False=Incoming, True=Outgoing)
├── sentimentvalue (Double, -100 to +100)
├── prioritycode (Picklist: 0=Low, 1=Normal, 2=High)
├── statecode (State: 0=Open, 1=Completed, 2=Canceled)
├── statuscode (Status: 1=Completed, 2=Failed, 3=Processing, 4=Open, 5=Canceled)
├── postfromprofileid (Lookup → SOCIALPROFILE)
├── postauthor (Customer → ACCOUNT/CONTACT)
├── postauthoraccount (Customer → ACCOUNT/CONTACT)
├── regardingobjectid (Lookup → ANY ENTITY)
├── inresponseto (String, 160)
├── threadid (String, 160)
├── ownerid (Owner → SYSTEMUSER/TEAM)
├── owningbusinessunit (Lookup → BUSINESSUNIT)
└── socialadditionalparams (Memo, JSON)

ACCOUNT
├── accountid (PK, Uniqueidentifier)
├── name (String)
└── ... (standard CRM fields)

CONTACT
├── contactid (PK, Uniqueidentifier)
├── firstname (String)
├── lastname (String)
└── ... (standard CRM fields)

CASE
├── caseid (PK, Uniqueidentifier)
├── title (String)
├── statuscode (Status)
└── ... (standard CRM fields)
```

---

## JSON Payload Examples

### SocialActivity.socialadditionalparams Example

```json
{
  "twitter": {
    "retweet_count": 42,
    "favorite_count": 187,
    "lang": "en",
    "source": "<a href=\"...\">Twitter Web Client</a>"
  },
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "place_name": "New York, NY"
  },
  "metadata": {
    "hashtags": ["#Microsoft", "#Dynamics365"],
    "mentions": ["@MSFTDynamics365"],
    "links": ["https://example.com"]
  },
  "engagement": {
    "impressions": 1500,
    "clicks": 45
  }
}
```

### SocialProfile.socialadditionalparams Example

```json
{
  "twitter": {
    "screen_name": "msftcrm",
    "verified": true,
    "location": "Redmond, WA",
    "description": "Official Microsoft Dynamics 365 account",
    "created_at": "2010-01-01T00:00:00Z",
    "url": "https://twitter.com/msftcrm"
  },
  "metrics": {
    "engagement_rate": 0.85,
    "influence_score": 92,
    "follower_growth_rate": 0.05
  },
  "categories": ["Technology", "Software", "CRM"],
  "social_presence": {
    "twitter": true,
    "facebook": false,
    "linkedin": true
  }
}
```

---

## Limitations and Notes

### 1. Discontinued Product
- Microsoft Social Engagement was **retired in 2018**
- Final supported version: Dynamics 365 Customer Engagement (on-premises) v9.1
- Replacement: Dynamics 365 Social Insights → Dynamics 365 Customer Insights

### 2. Customization
- The base model was **highly extensible**
- Organizations frequently added custom fields for:
  - Additional social channels (LinkedIn, Instagram, etc.)
  - Industry-specific metadata
  - Custom sentiment analysis categories
  - Internal classification schemes

### 3. External Data Storage
- Most channel-specific data was stored in `socialadditionalparams` as **JSON blobs**
- This design provided flexibility but made data less queryable via standard CRM queries
- Required custom code for complex analytics

### 4. Integration Points
Connected to Dynamics 365 via multiple methods:
- **Server-side synchronization**: Scheduled data pulls from social APIs
- **Real-time webhooks**: Immediate post ingestion for supported channels
- **Manual entry**: Via CRM UI for ad-hoc social data

### 5. Data Volume Considerations
- Designed to handle **high-volume social data** with:
  - **Pagination**: `has_more` and `next_cursor` fields in API responses
  - **Filtering**: By date ranges, channels, keywords, sentiment
  - **Retention policies**: Configurable aging out of old data
  - **Archiving**: Option to move historical data to separate storage

---

## Comparison with Modern Equivalents

| Microsoft Social Engagement Feature | Modern Dynamics 365 Equivalent |
|-------------------------------------|--------------------------------|
| SocialActivity Entity | Omnichannel Activity entities |
| SocialProfile Entity | Customer Insights customer profiles |
| Sentiment Analysis | AI Builder sentiment analysis models |
| Alerts/Watch Lists | Customer Insights topics and alerts |
| Automated Case Creation | Omnichannel routing with workflows |
| Multi-Channel Support | Omnichannel for Customer Service |
| Profile Enrichment | Customer Insights data enrichment |
| Analytics Dashboards | Power BI templates for Customer Insights |
| Social Listening | Customer Insights social listening |

---

## Additional Resources

- [Social entities (Developer Guide for Dynamics 365 Customer Engagement) | Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/customerengagement/on-premises/developer/social-entities?view=op-9-1)
- [Social Activity (SocialActivity) table/entity reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/socialactivity)
- [Social Profile (SocialProfile) table/entity reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/socialprofile)
- [Automatically create cases from email or social monitoring](https://learn.microsoft.com/en-us/dynamics365/customerengagement/on-premises/basics/basics-guide?view=op-9-1)

---

*Document generated based on analysis of Microsoft Dynamics 365 Customer Engagement (on-premises) v9.1 documentation and entity reference materials.*
