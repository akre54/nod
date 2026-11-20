import subprocess
import unittest

import dbus
import dbusmock


class FlatpakPowerTest(dbusmock.DBusTestCase):
    @classmethod
    def setUpClass(cls):
        cls.start_session_bus()

    def test_installed_power_services(self):
        services = [
            ("org.gnome.SessionManager", "/org/gnome/SessionManager",
             "org.gnome.SessionManager", "susu", ["Nod", "0", "Test work", "4"], "Uninhibit"),
            ("org.freedesktop.PowerManagement", "/org/freedesktop/PowerManagement/Inhibit",
             "org.freedesktop.PowerManagement.Inhibit", "ss", ["Nod", "Test work"], "UnInhibit"),
        ]
        for name, path, interface, signature, arguments, release in services:
            with self.subTest(service=name):
                process = self.spawn_server(name, path, interface, system_bus=False,
                                            stdout=subprocess.DEVNULL)
                self.addCleanup(process.wait)
                self.addCleanup(process.terminate)
                mock = dbus.Interface(self.get_dbus(system_bus=False).get_object(name, path),
                                      dbusmock.MOCK_IFACE)
                mock.AddMethods(interface, [("Inhibit", signature, "u", "ret = 847"),
                                            (release, "u", "", "")])
                command = ["flatpak", "run", "--command=gdbus"]
                target = ["io.n8n.Nod", "call", "--session", "--dest", name,
                          "--object-path", path, "--method"]
                inhibit = target + [f"{interface}.Inhibit"] + arguments
                subprocess.run(command + inhibit, check=True, timeout=15)
                subprocess.run(command + target + [f"{interface}.{release}", "847"],
                               check=True, timeout=15)
                self.assertEqual(len(mock.GetMethodCalls("Inhibit")), 1)
                self.assertEqual(list(mock.GetMethodCalls(release)[0][1]), [847])
                denied = subprocess.run(command + [f"--no-talk-name={name}"] + inhibit,
                                        capture_output=True, text=True, timeout=15)
                self.assertNotEqual(denied.returncode, 0, denied.stdout)
                self.assertIn("org.freedesktop.DBus.Error.ServiceUnknown", denied.stderr)
                self.assertTrue(self.get_dbus(system_bus=False).name_has_owner(name))
                self.assertEqual(len(mock.GetMethodCalls("Inhibit")), 1)


if __name__ == "__main__":
    unittest.main()
