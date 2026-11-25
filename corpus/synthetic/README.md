# Synthetic fixtures

Small exports written by hand, in the layout the bridge produces. They are **not** real TIA
Portal exports: they exist so the parser, the model and the document generators can be tested
before real exports are available.

Replace or complement them with anonymized real exports (see the corpus README) as soon as
those exist. Whenever a real export disagrees with a synthetic one, the real export wins and
the synthetic file is fixed.

`basic/` contains one PLC with three tag tables (one in a user group), a UDT, a global DB,
an SCL function with its `.scl` source and a LAD organization block. One tag (`Unused`) is
deliberately not referenced anywhere.

`v18/basic/hmi/Panel_1/alarms.json` is a handwritten normalized interchange example, with
multilingual HMI-origin and PLC-origin alarms. It is not native HMI XML or evidence of an
Openness API. Hardware JSON in the same case is also synthetic.
