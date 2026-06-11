# Transformation Matrices - Hand

Homogeneous transformation matrices between consecutive frames.
Convention: URDF RPY (XYZ extrinsic / ZYX intrinsic).

## Notation

### Frames

| Index | Link |
|-------|------|
| $L_{0}$ | base_link |
| $L_{1}$ | MOTOR_BASE_HOLDER_1 |
| $L_{2}$ | MOTOR_BASE_HOLDER_2 |
| $L_{3}$ | Hand_ST3215_Servo_3 |
| $L_{4}$ | Hand_ST3215_Servo |
| $L_{5}$ | Hand_ST3215_Servo_2 |
| $L_{6}$ | MOTOR_BASE_HOLDER_THUMB |
| $L_{7}$ | MOTOR_SECOND_JOINT_HOLDER |
| $L_{8}$ | MOTOR_FIRST_JOINT_HOLDER |
| $L_{9}$ | Hand_ST3215_Servo_4 |
| $L_{10}$ | Hand_ST3215_Servo_5 |
| $L_{11}$ | Hand_LINKAGE |
| $L_{12}$ | Hand_ST3215_Servo_6 |
| $L_{13}$ | Hand_LINKAGE_3 |
| $L_{14}$ | MOTOR_THUMB_JOINT_HOLDER |
| $L_{15}$ | Hand_BACK_PUSHER |
| $L_{16}$ | Hand_FINGERTIP_1 |
| $L_{17}$ | Hand_BACK_PUSHER_3 |
| $L_{18}$ | FINGERTIP_2 |
| $L_{19}$ | Hand_ST3215_Servo_7 |
| $L_{20}$ | Hand_LINKAGE_2 |
| $L_{21}$ | Hand_BACK_PUSHER_2 |
| $L_{22}$ | Hand_FINGERTIP_1_2 |

### Joint Variables

| Variable | Joint | Type | From | To |
|----------|-------|------|------|----|
| $q_{1}$ | Revolute_6 | revolute (rad) | $L_{3}$ | $L_{6}$ |
| $q_{2}$ | Revolute_15 | revolute (rad) | $L_{4}$ | $L_{7}$ |
| $q_{3}$ | Revolute_17 | revolute (rad) | $L_{5}$ | $L_{8}$ |
| $q_{4}$ | Revolute_19 | continuous (rad) | $L_{7}$ | $L_{11}$ |
| $q_{5}$ | Revolute_27 | continuous (rad) | $L_{8}$ | $L_{13}$ |
| $q_{6}$ | Revolute_14 | revolute (rad) | $L_{9}$ | $L_{14}$ |
| $q_{7}$ | Revolute_18 | revolute (rad) | $L_{10}$ | $L_{15}$ |
| $q_{8}$ | revolute_1 | continuous (rad) | $L_{11}$ | $L_{16}$ |
| $q_{9}$ | Revolute_26 | revolute (rad) | $L_{12}$ | $L_{17}$ |
| $q_{10}$ | Revolute | continuous (rad) | $L_{13}$ | $L_{18}$ |
| $q_{11}$ | Revolute_23 | continuous (rad) | $L_{14}$ | $L_{20}$ |
| $q_{12}$ | Revolute_22 | revolute (rad) | $L_{19}$ | $L_{21}$ |
| $q_{13}$ | revolute | continuous (rad) | $L_{20}$ | $L_{22}$ |

Shorthand: $c_i = \cos(q_i)$, $s_i = \sin(q_i)$

### Kinematic Tree

```
L0: base_link
  |-- [fixed] Rigid_1
  |   L1: MOTOR_BASE_HOLDER_1
  |     +-- [fixed] Rigid_3
  |         L4: Hand_ST3215_Servo
  |           +-- [revolute] Revolute_15 (q2)
  |               L7: MOTOR_SECOND_JOINT_HOLDER
  |                 |-- [fixed] Rigid_10
  |                 |   L10: Hand_ST3215_Servo_5
  |                 |     +-- [revolute] Revolute_18 (q7)
  |                 |         L15: Hand_BACK_PUSHER
  |                 +-- [continuous] Revolute_19 (q4)
  |                     L11: Hand_LINKAGE
  |                       +-- [continuous] revolute_1 (q8)
  |                           L16: Hand_FINGERTIP_1
  |-- [fixed] Rigid_2
  |   L2: MOTOR_BASE_HOLDER_2
  |     +-- [fixed] Rigid_4
  |         L5: Hand_ST3215_Servo_2
  |           +-- [revolute] Revolute_17 (q3)
  |               L8: MOTOR_FIRST_JOINT_HOLDER
  |                 |-- [fixed] Rigid_11
  |                 |   L12: Hand_ST3215_Servo_6
  |                 |     +-- [revolute] Revolute_26 (q9)
  |                 |         L17: Hand_BACK_PUSHER_3
  |                 +-- [continuous] Revolute_27 (q5)
  |                     L13: Hand_LINKAGE_3
  |                       +-- [continuous] Revolute (q10)
  |                           L18: FINGERTIP_2
  +-- [fixed] Rigid_5
      L3: Hand_ST3215_Servo_3
        +-- [revolute] Revolute_6 (q1)
            L6: MOTOR_BASE_HOLDER_THUMB
              +-- [fixed] Rigid_9
                  L9: Hand_ST3215_Servo_4
                    +-- [revolute] Revolute_14 (q6)
                        L14: MOTOR_THUMB_JOINT_HOLDER
                          |-- [fixed] Rigid_13
                          |   L19: Hand_ST3215_Servo_7
                          |     +-- [revolute] Revolute_22 (q12)
                          |         L21: Hand_BACK_PUSHER_2
                          +-- [continuous] Revolute_23 (q11)
                              L20: Hand_LINKAGE_2
                                +-- [continuous] revolute (q13)
                                    L22: Hand_FINGERTIP_1_2
```

## Transforms

## Rigid_1

$L_{0}$ **base_link** -> $L_{1}$ **MOTOR_BASE_HOLDER_1** (fixed)

- **origin xyz**: (-0.005, 0.02657, -0.073998) m
- **origin rpy**: (-1.570796, 0, 0) rad

### Local Transform

$$
T^{0}_{1} = \begin{bmatrix}
1 & 0 & 0 & -0.005 \\
0 & 0 & 1 & 0.02657 \\
0 & -1 & 0 & -0.073998 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Rigid_2

$L_{0}$ **base_link** -> $L_{2}$ **MOTOR_BASE_HOLDER_2** (fixed)

- **origin xyz**: (-0.005, 0.02657, -0.009998) m
- **origin rpy**: (-1.570796, 0, 0) rad

### Local Transform

$$
T^{0}_{2} = \begin{bmatrix}
1 & 0 & 0 & -0.005 \\
0 & 0 & 1 & 0.02657 \\
0 & -1 & 0 & -0.009998 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Rigid_5

$L_{0}$ **base_link** -> $L_{3}$ **Hand_ST3215_Servo_3** (fixed)

- **origin xyz**: (0.037733, -0.00805, -0.014697) m
- **origin rpy**: (3.141593, 0, 3.141593) rad

### Local Transform

$$
T^{0}_{3} = \begin{bmatrix}
-1 & 0 & 0 & 0.037733 \\
0 & 1 & 0 & -0.00805 \\
0 & 0 & -1 & -0.014697 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Rigid_3

$L_{1}$ **MOTOR_BASE_HOLDER_1** -> $L_{4}$ **Hand_ST3215_Servo** (fixed)

- **origin xyz**: (0.038733, -0.00805, -0.014697) m
- **origin rpy**: (3.141593, 0, 3.141593) rad

### Local Transform

$$
T^{1}_{4} = \begin{bmatrix}
-1 & 0 & 0 & 0.038733 \\
0 & 1 & 0 & -0.00805 \\
0 & 0 & -1 & -0.014697 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Rigid_4

$L_{2}$ **MOTOR_BASE_HOLDER_2** -> $L_{5}$ **Hand_ST3215_Servo_2** (fixed)

- **origin xyz**: (0.038733, -0.00805, -0.014697) m
- **origin rpy**: (3.141593, 0, 3.141593) rad

### Local Transform

$$
T^{2}_{5} = \begin{bmatrix}
-1 & 0 & 0 & 0.038733 \\
0 & 1 & 0 & -0.00805 \\
0 & 0 & -1 & -0.014697 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Revolute_6

$L_{3}$ **Hand_ST3215_Servo_3** -> $L_{6}$ **MOTOR_BASE_HOLDER_THUMB** (revolute)
  Variable: $q_{1}$

- **origin xyz**: (0, -0.03705, 0) m
- **origin rpy**: (-1.473858, 0.055821, -2.091687) rad
- **axis**: (-0.866025, 0, -0.5)
- **limits**: [-1.570796, 1.570796] rad ([-90deg, 90deg])

### Local Transform

$T^{3}_{6}(q_{1}) = T_{fixed} \cdot R_{axis}(q_{1})$ where:

$$
T_{fixed} = \begin{bmatrix}
-0.496877 & 0.111585 & 0.860617 & 0 \\
-0.866025 & 0 & -0.5 & -0.03705 \\
-0.055792 & -0.993755 & 0.096635 & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{1}) = \text{Rodrigues}(\hat{k}, q_{1})
\\
\end{bmatrix}
$$

---

## Revolute_15

$L_{4}$ **Hand_ST3215_Servo** -> $L_{7}$ **MOTOR_SECOND_JOINT_HOLDER** (revolute)
  Variable: $q_{2}$

- **origin xyz**: (0, -0.001, 0) m
- **origin rpy**: (-3.141593, -0.059969, 0) rad
- **axis**: (0, 1, 0)
- **limits**: [2.96706, 5.235988] rad ([170deg, 300deg])

### Local Transform

$T^{4}_{7}(q_{2}) = T_{fixed} \cdot R_{axis}(q_{2})$ where:

$$
T_{fixed} = \begin{bmatrix}
0.998202 & 0 & 0.059933 & 0 \\
0 & -1 & 0 & -0.001 \\
0.059933 & 0 & -0.998202 & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{2}) = \begin{bmatrix}
c_{2} & 0 & s_{2} & 0 \\
0 & 1 & 0 & 0 \\
-s_{2} & 0 & c_{2} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Revolute_17

$L_{5}$ **Hand_ST3215_Servo_2** -> $L_{8}$ **MOTOR_FIRST_JOINT_HOLDER** (revolute)
  Variable: $q_{3}$

- **origin xyz**: (0, -0.03725, 0) m
- **origin rpy**: (3.141593, 0, 0) rad
- **axis**: (0, -1, 0)
- **limits**: [-2.094395, 0.174533] rad ([-120deg, 10deg])

### Local Transform

$T^{5}_{8}(q_{3}) = T_{fixed} \cdot R_{axis}(q_{3})$ where:

$$
T_{fixed} = \begin{bmatrix}
1 & 0 & 0 & 0 \\
0 & -1 & 0 & -0.03725 \\
0 & 0 & -1 & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{3}) = \begin{bmatrix}
c_{3} & 0 & -s_{3} & 0 \\
0 & 1 & 0 & 0 \\
s_{3} & 0 & c_{3} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Rigid_9

$L_{6}$ **MOTOR_BASE_HOLDER_THUMB** -> $L_{9}$ **Hand_ST3215_Servo_4** (fixed)

- **origin xyz**: (-0.067095, -0.019463, 0.052481) m
- **origin rpy**: (0, 0, 3.141593) rad

### Local Transform

$$
T^{6}_{9} = \begin{bmatrix}
-1 & 0 & 0 & -0.067095 \\
0 & -1 & 0 & -0.019463 \\
0 & 0 & 1 & 0.052481 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Rigid_10

$L_{7}$ **MOTOR_SECOND_JOINT_HOLDER** -> $L_{10}$ **Hand_ST3215_Servo_5** (fixed)

- **origin xyz**: (0, 0.0371, 0.050056) m
- **origin rpy**: (0, -1.570796, 0) rad

### Local Transform

$$
T^{7}_{10} = \begin{bmatrix}
0 & 0 & -1 & 0 \\
0 & 1 & 0 & 0.0371 \\
1 & 0 & 0 & 0.050056 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Revolute_19

$L_{7}$ **MOTOR_SECOND_JOINT_HOLDER** -> $L_{11}$ **Hand_LINKAGE** (continuous)
  Variable: $q_{4}$

- **origin xyz**: (0.01, 0.02505, 0.065056) m
- **origin rpy**: (0, -0.349066, 3.141593) rad
- **axis**: (0, -1, 0)

### Local Transform

$T^{7}_{11}(q_{4}) = T_{fixed} \cdot R_{axis}(q_{4})$ where:

$$
T_{fixed} = \begin{bmatrix}
-0.939693 & 0 & 0.34202 & 0.01 \\
0 & -1 & 0 & 0.02505 \\
0.34202 & 0 & 0.939693 & 0.065056 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{4}) = \begin{bmatrix}
c_{4} & 0 & -s_{4} & 0 \\
0 & 1 & 0 & 0 \\
s_{4} & 0 & c_{4} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Rigid_11

$L_{8}$ **MOTOR_FIRST_JOINT_HOLDER** -> $L_{12}$ **Hand_ST3215_Servo_6** (fixed)

- **origin xyz**: (0, 0.00105, 0.050056) m
- **origin rpy**: (0, -1.570796, 0) rad

### Local Transform

$$
T^{8}_{12} = \begin{bmatrix}
0 & 0 & -1 & 0 \\
0 & 1 & 0 & 0.00105 \\
1 & 0 & 0 & 0.050056 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Revolute_27

$L_{8}$ **MOTOR_FIRST_JOINT_HOLDER** -> $L_{13}$ **Hand_LINKAGE_3** (continuous)
  Variable: $q_{5}$

- **origin xyz**: (0.01, -0.0253, 0.065056) m
- **origin rpy**: (0, -0.535148, 3.141593) rad
- **axis**: (0, 1, 0)

### Local Transform

$T^{8}_{13}(q_{5}) = T_{fixed} \cdot R_{axis}(q_{5})$ where:

$$
T_{fixed} = \begin{bmatrix}
-0.860193 & 0 & 0.509968 & 0.01 \\
0 & -1 & 0 & -0.0253 \\
0.509968 & 0 & 0.860193 & 0.065056 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{5}) = \begin{bmatrix}
c_{5} & 0 & s_{5} & 0 \\
0 & 1 & 0 & 0 \\
-s_{5} & 0 & c_{5} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Revolute_14

$L_{9}$ **Hand_ST3215_Servo_4** -> $L_{14}$ **MOTOR_THUMB_JOINT_HOLDER** (revolute)
  Variable: $q_{6}$

- **origin xyz**: (0, -0.03705, 0) m
- **origin rpy**: (0, 0.78179, 0) rad
- **axis**: (0, 1, 0)
- **limits**: [-1.570796, 1.570796] rad ([-90deg, 90deg])

### Local Transform

$T^{9}_{14}(q_{6}) = T_{fixed} \cdot R_{axis}(q_{6})$ where:

$$
T_{fixed} = \begin{bmatrix}
0.709653 & 0 & 0.704551 & 0 \\
0 & 1 & 0 & -0.03705 \\
-0.704551 & 0 & 0.709653 & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{6}) = \begin{bmatrix}
c_{6} & 0 & s_{6} & 0 \\
0 & 1 & 0 & 0 \\
-s_{6} & 0 & c_{6} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Revolute_18

$L_{10}$ **Hand_ST3215_Servo_5** -> $L_{15}$ **Hand_BACK_PUSHER** (revolute)
  Variable: $q_{7}$

- **origin xyz**: (0, -0.001, 0) m
- **origin rpy**: (-3.141593, 1.340573, -3.141593) rad
- **axis**: (0, -1, 0)
- **limits**: [-1.832596, 0.174533] rad ([-105deg, 10deg])

### Local Transform

$T^{10}_{15}(q_{7}) = T_{fixed} \cdot R_{axis}(q_{7})$ where:

$$
T_{fixed} = \begin{bmatrix}
-0.228195 & 0 & 0.973615 & 0 \\
0 & 1 & 0 & -0.001 \\
-0.973615 & 0 & -0.228195 & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{7}) = \begin{bmatrix}
c_{7} & 0 & -s_{7} & 0 \\
0 & 1 & 0 & 0 \\
s_{7} & 0 & c_{7} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## revolute_1

$L_{11}$ **Hand_LINKAGE** -> $L_{16}$ **Hand_FINGERTIP_1** (continuous)
  Variable: $q_{8}$

- **origin xyz**: (0, 0.0141, 0.030154) m
- **origin rpy**: (0, 0.230712, 0) rad
- **axis**: (0, 1, 0)

### Local Transform

$T^{11}_{16}(q_{8}) = T_{fixed} \cdot R_{axis}(q_{8})$ where:

$$
T_{fixed} = \begin{bmatrix}
0.973504 & 0 & 0.228671 & 0 \\
0 & 1 & 0 & 0.0141 \\
-0.228671 & 0 & 0.973504 & 0.030154 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{8}) = \begin{bmatrix}
c_{8} & 0 & s_{8} & 0 \\
0 & 1 & 0 & 0 \\
-s_{8} & 0 & c_{8} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Revolute_26

$L_{12}$ **Hand_ST3215_Servo_6** -> $L_{17}$ **Hand_BACK_PUSHER_3** (revolute)
  Variable: $q_{9}$

- **origin xyz**: (0, -0.03725, 0) m
- **origin rpy**: (-3.141593, 1.22173, -3.141593) rad
- **axis**: (0, 1, 0)
- **limits**: [-0.174533, 1.658063] rad ([-10deg, 95deg])

### Local Transform

$T^{12}_{17}(q_{9}) = T_{fixed} \cdot R_{axis}(q_{9})$ where:

$$
T_{fixed} = \begin{bmatrix}
-0.34202 & 0 & 0.939693 & 0 \\
0 & 1 & 0 & -0.03725 \\
-0.939693 & 0 & -0.34202 & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{9}) = \begin{bmatrix}
c_{9} & 0 & s_{9} & 0 \\
0 & 1 & 0 & 0 \\
-s_{9} & 0 & c_{9} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Revolute

$L_{13}$ **Hand_LINKAGE_3** -> $L_{18}$ **FINGERTIP_2** (continuous)
  Variable: $q_{10}$

- **origin xyz**: (0, 0, 0.030154) m
- **origin rpy**: (3.141593, 0.319579, 0) rad
- **axis**: (0, -1, 0)

### Local Transform

$T^{13}_{18}(q_{10}) = T_{fixed} \cdot R_{axis}(q_{10})$ where:

$$
T_{fixed} = \begin{bmatrix}
0.949368 & 0 & -0.314167 & 0 \\
0 & -1 & 0 & 0 \\
-0.314167 & 0 & -0.949368 & 0.030154 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{10}) = \begin{bmatrix}
c_{10} & 0 & -s_{10} & 0 \\
0 & 1 & 0 & 0 \\
s_{10} & 0 & c_{10} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Rigid_13

$L_{14}$ **MOTOR_THUMB_JOINT_HOLDER** -> $L_{19}$ **Hand_ST3215_Servo_7** (fixed)

- **origin xyz**: (0, 0.0371, 0.050056) m
- **origin rpy**: (0, -1.570796, 0) rad

### Local Transform

$$
T^{14}_{19} = \begin{bmatrix}
0 & 0 & -1 & 0 \\
0 & 1 & 0 & 0.0371 \\
1 & 0 & 0 & 0.050056 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Revolute_23

$L_{14}$ **MOTOR_THUMB_JOINT_HOLDER** -> $L_{20}$ **Hand_LINKAGE_2** (continuous)
  Variable: $q_{11}$

- **origin xyz**: (0.01, 0.02505, 0.065056) m
- **origin rpy**: (0, 0.15035, 0) rad
- **axis**: (0, 1, 0)

### Local Transform

$T^{14}_{20}(q_{11}) = T_{fixed} \cdot R_{axis}(q_{11})$ where:

$$
T_{fixed} = \begin{bmatrix}
0.988719 & 0 & 0.149784 & 0.01 \\
0 & 1 & 0 & 0.02505 \\
-0.149784 & 0 & 0.988719 & 0.065056 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{11}) = \begin{bmatrix}
c_{11} & 0 & s_{11} & 0 \\
0 & 1 & 0 & 0 \\
-s_{11} & 0 & c_{11} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Revolute_22

$L_{19}$ **Hand_ST3215_Servo_7** -> $L_{21}$ **Hand_BACK_PUSHER_2** (revolute)
  Variable: $q_{12}$

- **origin xyz**: (0, -0.001, 0) m
- **origin rpy**: (-3.141593, 1.470661, -3.141593) rad
- **axis**: (0, -1, 0)
- **limits**: [1.48353, 3.316126] rad ([85deg, 190deg])

### Local Transform

$T^{19}_{21}(q_{12}) = T_{fixed} \cdot R_{axis}(q_{12})$ where:

$$
T_{fixed} = \begin{bmatrix}
-0.099968 & 0 & 0.994991 & 0 \\
0 & 1 & 0 & -0.001 \\
-0.994991 & 0 & -0.099968 & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{12}) = \begin{bmatrix}
c_{12} & 0 & -s_{12} & 0 \\
0 & 1 & 0 & 0 \\
s_{12} & 0 & c_{12} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## revolute

$L_{20}$ **Hand_LINKAGE_2** -> $L_{22}$ **Hand_FINGERTIP_1_2** (continuous)
  Variable: $q_{13}$

- **origin xyz**: (0, -0.0141, 0.030154) m
- **origin rpy**: (0, 0.109373, -3.141593) rad
- **axis**: (0, 1, 0)

### Local Transform

$T^{20}_{22}(q_{13}) = T_{fixed} \cdot R_{axis}(q_{13})$ where:

$$
T_{fixed} = \begin{bmatrix}
-0.994025 & 0 & -0.109155 & 0 \\
0 & -1 & 0 & -0.0141 \\
-0.109155 & 0 & 0.994025 & 0.030154 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

$$
R_{axis}(q_{13}) = \begin{bmatrix}
c_{13} & 0 & s_{13} & 0 \\
0 & 1 & 0 & 0 \\
-s_{13} & 0 & c_{13} & 0 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
$$

---

## Global Transform Chains

Transform from root $L_0$ to any link, as product of local transforms along the kinematic chain.

$$T^{0}_{4} = T^{0}_{1} \cdot T^{1}_{4}\quad (L_0 \to L_{4}: \text{Hand_ST3215_Servo})$$

$$T^{0}_{5} = T^{0}_{2} \cdot T^{2}_{5}\quad (L_0 \to L_{5}: \text{Hand_ST3215_Servo_2})$$

$$T^{0}_{6} = T^{0}_{3} \cdot T^{3}_{6}(q_{1})\quad (L_0 \to L_{6}: \text{MOTOR_BASE_HOLDER_THUMB})$$

$$T^{0}_{7} = T^{0}_{1} \cdot T^{1}_{4} \cdot T^{4}_{7}(q_{2})\quad (L_0 \to L_{7}: \text{MOTOR_SECOND_JOINT_HOLDER})$$

$$T^{0}_{8} = T^{0}_{2} \cdot T^{2}_{5} \cdot T^{5}_{8}(q_{3})\quad (L_0 \to L_{8}: \text{MOTOR_FIRST_JOINT_HOLDER})$$

$$T^{0}_{9} = T^{0}_{3} \cdot T^{3}_{6}(q_{1}) \cdot T^{6}_{9}\quad (L_0 \to L_{9}: \text{Hand_ST3215_Servo_4})$$

$$T^{0}_{10} = T^{0}_{1} \cdot T^{1}_{4} \cdot T^{4}_{7}(q_{2}) \cdot T^{7}_{10}\quad (L_0 \to L_{10}: \text{Hand_ST3215_Servo_5})$$

$$T^{0}_{11} = T^{0}_{1} \cdot T^{1}_{4} \cdot T^{4}_{7}(q_{2}) \cdot T^{7}_{11}(q_{4})\quad (L_0 \to L_{11}: \text{Hand_LINKAGE})$$

$$T^{0}_{12} = T^{0}_{2} \cdot T^{2}_{5} \cdot T^{5}_{8}(q_{3}) \cdot T^{8}_{12}\quad (L_0 \to L_{12}: \text{Hand_ST3215_Servo_6})$$

$$T^{0}_{13} = T^{0}_{2} \cdot T^{2}_{5} \cdot T^{5}_{8}(q_{3}) \cdot T^{8}_{13}(q_{5})\quad (L_0 \to L_{13}: \text{Hand_LINKAGE_3})$$

$$T^{0}_{14} = T^{0}_{3} \cdot T^{3}_{6}(q_{1}) \cdot T^{6}_{9} \cdot T^{9}_{14}(q_{6})\quad (L_0 \to L_{14}: \text{MOTOR_THUMB_JOINT_HOLDER})$$

$$T^{0}_{15} = T^{0}_{1} \cdot T^{1}_{4} \cdot T^{4}_{7}(q_{2}) \cdot T^{7}_{10} \cdot T^{10}_{15}(q_{7})\quad (L_0 \to L_{15}: \text{Hand_BACK_PUSHER})$$

$$T^{0}_{16} = T^{0}_{1} \cdot T^{1}_{4} \cdot T^{4}_{7}(q_{2}) \cdot T^{7}_{11}(q_{4}) \cdot T^{11}_{16}(q_{8})\quad (L_0 \to L_{16}: \text{Hand_FINGERTIP_1})$$

$$T^{0}_{17} = T^{0}_{2} \cdot T^{2}_{5} \cdot T^{5}_{8}(q_{3}) \cdot T^{8}_{12} \cdot T^{12}_{17}(q_{9})\quad (L_0 \to L_{17}: \text{Hand_BACK_PUSHER_3})$$

$$T^{0}_{18} = T^{0}_{2} \cdot T^{2}_{5} \cdot T^{5}_{8}(q_{3}) \cdot T^{8}_{13}(q_{5}) \cdot T^{13}_{18}(q_{10})\quad (L_0 \to L_{18}: \text{FINGERTIP_2})$$

$$T^{0}_{19} = T^{0}_{3} \cdot T^{3}_{6}(q_{1}) \cdot T^{6}_{9} \cdot T^{9}_{14}(q_{6}) \cdot T^{14}_{19}\quad (L_0 \to L_{19}: \text{Hand_ST3215_Servo_7})$$

$$T^{0}_{20} = T^{0}_{3} \cdot T^{3}_{6}(q_{1}) \cdot T^{6}_{9} \cdot T^{9}_{14}(q_{6}) \cdot T^{14}_{20}(q_{11})\quad (L_0 \to L_{20}: \text{Hand_LINKAGE_2})$$

$$T^{0}_{21} = T^{0}_{3} \cdot T^{3}_{6}(q_{1}) \cdot T^{6}_{9} \cdot T^{9}_{14}(q_{6}) \cdot T^{14}_{19} \cdot T^{19}_{21}(q_{12})\quad (L_0 \to L_{21}: \text{Hand_BACK_PUSHER_2})$$

$$T^{0}_{22} = T^{0}_{3} \cdot T^{3}_{6}(q_{1}) \cdot T^{6}_{9} \cdot T^{9}_{14}(q_{6}) \cdot T^{14}_{20}(q_{11}) \cdot T^{20}_{22}(q_{13})\quad (L_0 \to L_{22}: \text{Hand_FINGERTIP_1_2})$$

