# 🐘 Azure Database for PostgreSQL (Flexible Server)

resource "azurerm_postgresql_flexible_server" "db" {
  name                   = "unbrdn-postgres-server"
  resource_group_name    = data.azurerm_resource_group.unbrdn.name
  location               = data.azurerm_resource_group.unbrdn.location
  version                = "15"
  administrator_login    = "psqladmin"
  administrator_password = "SecurePassword123!"

  sku_name   = "GP_Standard_D2s_v3"
  storage_mb = 32768
}

# 🔴 Azure Cache for Redis (Track 3)
resource "azurerm_redis_cache" "redis" {
  name                = "unbrdn-redis-track3"
  resource_group_name = data.azurerm_resource_group.unbrdn.name
  location            = data.azurerm_resource_group.unbrdn.location
  capacity            = 1
  family              = "C"
  sku_name            = "Standard"
  non_ssl_port_enabled = false
}
