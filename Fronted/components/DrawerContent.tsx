import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, usePathname } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { Colors } from '@/constants/Colors'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

interface NavItem {
  label: string
  icon:  IoniconsName
  iconActive: IoniconsName
  route: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Mapa', icon: 'map-outline', iconActive: 'map', route: '/(app)/' },
]

interface Props { navigation: any }

export default function DrawerContent({ navigation }: Props) {
  const { cuidador, logout } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  const initial = cuidador?.name?.charAt(0)?.toUpperCase() ?? '?'

  const handleLogout = async () => {
    navigation.closeDrawer()
    await logout()
    router.replace('/login' as any)
  }

  const handleNav = (route: string) => {
    navigation.closeDrawer()
    router.replace(route as any)
  }

  return (
    <SafeAreaView style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {cuidador?.name ?? 'Cuidador'}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {cuidador?.email ?? ''}
        </Text>
        <View style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>Sesión activa</Text>
        </View>
      </View>

      <View style={styles.sep} />

      {/* Navegación */}
      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.route || pathname === '/'
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => handleNav(item.route)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={active ? item.iconActive : item.icon}
                size={20}
                color={active ? Colors.drawerText : Colors.drawerMuted}
                style={styles.navIcon}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
              {active && <View style={styles.activeBar} />}
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.sep} />
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.75}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} style={styles.navIcon} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.drawerBg,
  },

  header: {
    paddingHorizontal: 24,
    paddingTop:        48,
    paddingBottom:     28,
    alignItems:        'center',
  },
  avatar: {
    width:            68,
    height:           68,
    borderRadius:     34,
    backgroundColor:  Colors.primary,
    justifyContent:   'center',
    alignItems:       'center',
    marginBottom:     14,
    borderWidth:      2,
    borderColor:      Colors.primaryMid,
  },
  avatarText: {
    fontSize:   28,
    fontWeight: '700',
    color:      Colors.white,
  },
  name: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.drawerText,
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    color:    Colors.drawerMuted,
    marginBottom: 12,
  },
  activeBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:    20,
    gap: 6,
  },
  activeDot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: Colors.success,
  },
  activeText: {
    fontSize:   12,
    color:      Colors.success,
    fontWeight: '600',
  },

  sep: {
    height:          1,
    backgroundColor: Colors.drawerBorder,
    marginHorizontal: 20,
  },

  nav: {
    flex:           1,
    paddingHorizontal: 14,
    paddingTop:     20,
  },
  navItem: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical:  14,
    paddingHorizontal: 16,
    borderRadius:   14,
    marginBottom:   4,
  },
  navItemActive: {
    backgroundColor: Colors.drawerItem,
  },
  navIcon: {
    marginRight: 14,
  },
  navLabel: {
    flex:       1,
    fontSize:   15,
    fontWeight: '500',
    color:      Colors.drawerMuted,
  },
  navLabelActive: {
    color:      Colors.drawerText,
    fontWeight: '700',
  },
  activeBar: {
    width:           4,
    height:          20,
    borderRadius:    2,
    backgroundColor: Colors.primary,
  },

  footer: {
    paddingBottom: 16,
  },
  logoutBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical:  14,
    paddingHorizontal: 30,
    marginTop:       8,
  },
  logoutText: {
    fontSize:   15,
    color:      Colors.error,
    fontWeight: '600',
  },
})
