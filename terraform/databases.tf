# 🐘 Azure Database for PostgreSQL (Flexible Server)

resource "azurerm_postgresql_flexible_server" "db" {
  name                   = "unbrdn-postgres"
  resource_group_name    = local.rg_name
  location               = "Korea Central"
  version                = "15"
  administrator_login    = "psqladmin"
  administrator_password = var.db_password

  sku_name   = "GP_Standard_D2s_v3"
  storage_mb = 32768

  lifecycle {
    ignore_changes = [zone, administrator_password]
  }
}

# AKS → Azure PostgreSQL 접근 허용 (Azure 내부 서비스 허용)
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  name      = "AllowAzureServices"
  server_id = azurerm_postgresql_flexible_server.db.id
  # Azure Portal "Allow Azure services" 특수 룰: 0.0.0.0 → 0.0.0.0
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# 🔴 Azure Cache for Redis (Track 3)
resource "azurerm_redis_cache" "redis" {
  name                 = "unbrdn-redis-track3"
  resource_group_name  = local.rg_name
  location             = "Korea Central"
  capacity             = 1
  family               = "C"
  sku_name             = "Standard"
  non_ssl_port_enabled = false
}
