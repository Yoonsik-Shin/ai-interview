# ☁️ Azure Storage Account (Blob Storage)

resource "azurerm_storage_account" "storage" {
  name                     = "unbrdnstorage" # 전역 고유 이름
  resource_group_name      = local.rg_name
  location               = "Korea Central"
  account_tier             = "Standard"
  account_replication_type = "LRS" # 로컬 중복 스토리지 (비용 최적화)

  network_rules {
    default_action             = "Allow"
    bypass                     = ["AzureServices"]
  }
}

resource "azurerm_storage_container" "blob" {
  name                  = "unbrdn-blob"
  storage_account_id    = azurerm_storage_account.storage.id
  container_access_type = "private" # 보안을 위해 프라이빗 설정
}
