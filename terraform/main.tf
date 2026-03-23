# 🌍 전면 Azure 100% Terraform Provider & Base RG
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "unbrdn" {
  name     = "unbrdn-aks-rg"
  location = "Korea Central"
}
