@description('The location for all resources.')
param location string = resourceGroup().location

@description('The name of the Azure AI Foundry project resource.')
param aiProjectName string = 'socialengage-ai-project'

@description('The name of the Azure AI hub resource.')
param aiHubName string = 'socialengage-ai-hub'

@description('The name of the storage account used by the project.')
param storageAccountName string = take(toLower(replace('socialengage${uniqueString(resourceGroup().id)}', '-', '')), 24)

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    supportsHttpsTrafficOnly: true
  }
}

resource aiHub 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: aiHubName
  location: location
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: toLower(aiHubName)
    publicNetworkAccess: 'Enabled'
    apiProperties: {}
  }
}

output aiHubName string = aiHub.name
output aiProjectName string = aiProjectName
output storageAccountName string = storageAccount.name
