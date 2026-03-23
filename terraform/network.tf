# 🌐 VNet 및 Subnet 구성 (AKS 전용)

resource "azurerm_virtual_network" "vnet" {
  name                = "unbrdn-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.unbrdn.location
  resource_group_name = azurerm_resource_group.unbrdn.name
}

resource "azurerm_subnet" "aks_subnet" {
  name                 = "aks-subnet"
  resource_group_name  = azurerm_resource_group.unbrdn.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]
}
