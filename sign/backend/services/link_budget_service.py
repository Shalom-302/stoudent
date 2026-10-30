"""Labo Terrain - link budgets of the telecom sites in the city.

Two calculations a BTS RIT student does by hand, done here so the 3D shows
what the formulas say rather than what the scene guesses:

* a microwave link (faisceau hertzien): free-space loss, dish gains,
  received level, fade margin, and whether the first Fresnel zone clears the
  obstacle between the two towers (earth bulge included, k = 4/3);
* a GPON fibre drop: fibre attenuation, splices, connectors and the splitters
  between the central office (NRO) and the subscriber (ONU).

Pure functions, no I/O: the same contract as the signal services.
"""
from __future__ import annotations

import math

SPEED_OF_LIGHT = 299_792_458.0
DISH_EFFICIENCY = 0.55
# Effective earth radius factor in standard atmosphere.
K_FACTOR = 4 / 3
EARTH_RADIUS_KM = 6371.0
# Share of the first Fresnel zone that must stay clear (ITU-R P.530 practice).
FRESNEL_CLEARANCE = 0.6

# Typical insertion loss of a PLC splitter, dB (ITU-T G.671 class values).
SPLITTER_LOSS_DB = {2: 3.7, 4: 7.3, 8: 10.5, 16: 13.7, 32: 17.1, 64: 20.5}
# ONUs one GPON port can address (ITU-T G.984 logical split).
GPON_MAX_SPLIT = 128


def _r(value: float, digits: int = 2) -> float:
    return round(value, digits)


class LinkBudgetService:
    @staticmethod
    def free_space_loss_db(frequency_ghz: float, distance_km: float) -> float:
        """FSPL = 92.45 + 20 log10(f GHz) + 20 log10(d km)."""
        return 92.45 + 20 * math.log10(frequency_ghz) + 20 * math.log10(distance_km)

    @staticmethod
    def dish_gain_dbi(diameter_m: float, frequency_ghz: float) -> float:
        """G = 10 log10(eta (pi D / lambda)^2), eta = 0.55."""
        wavelength = SPEED_OF_LIGHT / (frequency_ghz * 1e9)
        return 10 * math.log10(DISH_EFFICIENCY * (math.pi * diameter_m / wavelength) ** 2)

    @staticmethod
    def fresnel_radius_m(frequency_ghz: float, d1_km: float, d2_km: float) -> float:
        """First Fresnel zone radius: r = 17.32 sqrt(d1 d2 / (f d)), metres."""
        return 17.32 * math.sqrt(d1_km * d2_km / (frequency_ghz * (d1_km + d2_km)))

    @staticmethod
    def earth_bulge_m(d1_km: float, d2_km: float) -> float:
        """Height of the earth's curve above the chord: d1 d2 / (2 k R), metres."""
        return d1_km * d2_km / (2 * K_FACTOR * EARTH_RADIUS_KM) * 1000

    def microwave_link(
        self,
        *,
        frequency_ghz: float,
        distance_km: float,
        tx_power_dbm: float,
        dish_diameter_m: float,
        losses_db: float,
        sensitivity_dbm: float,
        height_a_m: float,
        height_b_m: float,
        obstacle_height_m: float,
        obstacle_at_km: float | None = None,
    ) -> dict:
        """Budget of a point-to-point link between two towers A and B.

        Ground is taken flat at 0 m; the obstacle (a building, a hill) stands
        at ``obstacle_at_km`` from A, the middle by default.
        """
        d1 = obstacle_at_km if obstacle_at_km is not None else distance_km / 2
        d1 = min(max(d1, 0.01), distance_km - 0.01)
        d2 = distance_km - d1

        fspl = self.free_space_loss_db(frequency_ghz, distance_km)
        gain = self.dish_gain_dbi(dish_diameter_m, frequency_ghz)
        received = tx_power_dbm + 2 * gain - fspl - losses_db
        margin = received - sensitivity_dbm

        # Line of sight between the two antennas, above the obstacle point.
        line_of_sight = height_a_m + (height_b_m - height_a_m) * d1 / distance_km
        bulge = self.earth_bulge_m(d1, d2)
        radius = self.fresnel_radius_m(frequency_ghz, d1, d2)
        clearance = line_of_sight - bulge - obstacle_height_m
        clearance_ratio = clearance / radius
        clear = clearance_ratio >= FRESNEL_CLEARANCE
        # Antenna height that clears 60 % of the zone, both towers raised alike.
        missing = max(FRESNEL_CLEARANCE * radius - clearance, 0.0)

        if not clear and clearance < 0:
            verdict = 'Liaison coupée : l’obstacle masque la visibilité directe entre les deux antennes.'
        elif not clear:
            verdict = 'Visibilité directe, mais la 1re zone de Fresnel est trop obstruée : le signal s’affaiblit.'
        elif margin < 0:
            verdict = 'Zone de Fresnel dégagée, mais le niveau reçu est sous la sensibilité du récepteur.'
        elif margin < 20:
            verdict = 'Liaison établie, marge faible : une forte pluie peut la couper.'
        else:
            verdict = 'Liaison établie avec une bonne marge.'

        return {
            'free_space_loss_db': _r(fspl),
            'dish_gain_dbi': _r(gain),
            'received_dbm': _r(received),
            'fade_margin_db': _r(margin),
            'fresnel_radius_m': _r(radius),
            'earth_bulge_m': _r(bulge),
            'line_of_sight_m': _r(line_of_sight),
            'clearance_m': _r(clearance),
            'clearance_ratio': _r(clearance_ratio, 3),
            'fresnel_clear': bool(clear),
            'raise_towers_by_m': _r(missing, 1),
            'link_up': bool(clear and margin >= 0),
            'verdict': verdict,
        }

    @staticmethod
    def fibre_drop(
        *,
        length_km: float,
        wavelength_nm: int,
        splices: int,
        connectors: int,
        splitters: list[int],
        olt_power_dbm: float,
        onu_sensitivity_dbm: float,
        splice_loss_db: float = 0.1,
        connector_loss_db: float = 0.5,
    ) -> dict:
        """GPON optical budget from the OLT (NRO) to the subscriber's ONU."""
        attenuation = {1310: 0.35, 1490: 0.28, 1550: 0.25}[wavelength_nm]
        fibre = length_km * attenuation
        joints = splices * splice_loss_db
        plugs = connectors * connector_loss_db
        split = sum(SPLITTER_LOSS_DB[n] for n in splitters)
        total = fibre + joints + plugs + split
        received = olt_power_dbm - total
        margin = received - onu_sensitivity_dbm
        subscribers = math.prod(splitters) if splitters else 1
        split_ok = subscribers <= GPON_MAX_SPLIT

        if not split_ok:
            verdict = f'{subscribers} abonnés sur un port : un port GPON n’en gère que {GPON_MAX_SPLIT}.'
        elif margin < 0:
            verdict = 'Le signal arrive sous la sensibilité de la box : l’abonné n’a pas Internet.'
        elif margin < 3:
            verdict = 'Ça passe, mais sans marge : une soudure ratée ou un connecteur sale coupera la ligne.'
        else:
            verdict = 'Budget optique respecté.'

        return {
            'attenuation_db_per_km': attenuation,
            'fibre_loss_db': _r(fibre),
            'splice_loss_db': _r(joints),
            'connector_loss_db': _r(plugs),
            'splitter_loss_db': _r(split),
            'total_loss_db': _r(total),
            'received_dbm': _r(received),
            'margin_db': _r(margin),
            'subscribers_per_port': subscribers,
            'split_ok': split_ok,
            'link_up': bool(margin >= 0 and split_ok),
            'verdict': verdict,
        }


link_budget_service = LinkBudgetService()
