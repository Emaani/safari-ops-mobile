package com.jackaladventures.safariops.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.jackaladventures.safariops.screens.*

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            BottomNavigationBar(navController = navController)
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = "dashboard",
            modifier = Modifier.padding(paddingValues)
        ) {
            composable("dashboard") { DashboardScreen() }
            composable("bookings") { BookingsScreen() }
            composable("fleet") { FleetScreen() }
            composable("finance") { FinanceScreen() }
            composable("more") { MoreScreen() }
        }
    }
}

@Composable
fun BottomNavigationBar(navController: NavHostController) {
    NavigationBar {
        NavigationBarItem(
            icon = { Icon(Icons.Filled.BarChart, contentDescription = "Dashboard") },
            label = { Text("Dashboard") },
            selected = navController.currentDestination?.route == "dashboard",
            onClick = { navController.navigate("dashboard") }
        )
        NavigationBarItem(
            icon = { Icon(Icons.Filled.DateRange, contentDescription = "Bookings") },
            label = { Text("Bookings") },
            selected = navController.currentDestination?.route == "bookings",
            onClick = { navController.navigate("bookings") }
        )
        NavigationBarItem(
            icon = { Icon(Icons.Filled.DirectionsCar, contentDescription = "Fleet") },
            label = { Text("Fleet") },
            selected = navController.currentDestination?.route == "fleet",
            onClick = { navController.navigate("fleet") }
        )
        NavigationBarItem(
            icon = { Icon(Icons.Filled.AttachMoney, contentDescription = "Finance") },
            label = { Text("Finance") },
            selected = navController.currentDestination?.route == "finance",
            onClick = { navController.navigate("finance") }
        )
        NavigationBarItem(
            icon = { Icon(Icons.Filled.MoreVert, contentDescription = "More") },
            label = { Text("More") },
            selected = navController.currentDestination?.route == "more",
            onClick = { navController.navigate("more") }
        )
    }
}