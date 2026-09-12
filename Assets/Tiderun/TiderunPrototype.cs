using System.Collections.Generic;
using UnityEngine;

namespace Tiderun
{
    public static class TiderunBootstrap
    {
        private static bool built;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void BuildPrototype()
        {
            if (built || Object.FindObjectOfType<GameManager>() != null) return;
            built = true;

            Application.targetFrameRate = 60;
            Screen.orientation = ScreenOrientation.Portrait;

            Material blue = MakeMaterial(new Color32(40, 145, 255, 255));
            Material red = MakeMaterial(new Color32(235, 68, 72, 255));
            Material yellow = MakeMaterial(new Color32(255, 208, 70, 255));
            Material cyan = MakeMaterial(new Color32(70, 225, 255, 255));
            Material dark = MakeMaterial(new Color32(52, 58, 68, 255));
            Material ground = MakeMaterial(new Color32(205, 210, 218, 255));

            GameObject gmObject = new GameObject("GameManager");
            GameManager gm = gmObject.AddComponent<GameManager>();

            CreateLight();
            CreateTrack(ground, dark);

            GameObject squadObject = new GameObject("Squad");
            squadObject.transform.position = new Vector3(0f, 0.55f, 2f);
            BoxCollider squadCollider = squadObject.AddComponent<BoxCollider>();
            squadCollider.isTrigger = true;
            squadCollider.size = new Vector3(4.2f, 1.3f, 1.5f);
            Rigidbody squadBody = squadObject.AddComponent<Rigidbody>();
            squadBody.isKinematic = true;
            squadBody.useGravity = false;

            SquadController squad = squadObject.AddComponent<SquadController>();
            squad.Initialize(blue, yellow, 8);
            gm.Squad = squad;

            CreateCamera(squadObject.transform);

            CreateGate(new Vector3(-1.9f, 1.1f, 22f), 1, 25, blue);
            CreateGate(new Vector3(1.9f, 1.1f, 22f), 1, 12, cyan);

            CreateEnemyWave(new Vector3(0f, 0.55f, 39f), 24, 6, red);

            CreateGate(new Vector3(-1.9f, 1.1f, 59f), 1, 99, cyan);
            CreateGate(new Vector3(1.9f, 1.1f, 59f), 1, 50, blue);

            CreateEnemyWave(new Vector3(0f, 0.55f, 78f), 72, 9, red);
            CreateEnemyWave(new Vector3(0f, 0.55f, 96f), 45, 9, red);

            GameObject bossObject = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            bossObject.name = "Boss_666HP";
            bossObject.transform.position = new Vector3(0f, 1.65f, 125f);
            bossObject.transform.localScale = new Vector3(2.4f, 2.4f, 2.4f);
            bossObject.GetComponent<Renderer>().material = red;
            Collider bossCollider = bossObject.GetComponent<Collider>();
            bossCollider.isTrigger = true;
            BossUnit boss = bossObject.AddComponent<BossUnit>();
            boss.Initialize(666f);
            gm.Boss = boss;

            CreateFinishMarker(new Vector3(0f, 0.02f, 135f), yellow);
        }

        private static Material MakeMaterial(Color color)
        {
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) shader = Shader.Find("Standard");
            Material material = new Material(shader);
            material.color = color;
            return material;
        }

        private static void CreateLight()
        {
            GameObject lightObject = new GameObject("Sun");
            Light light = lightObject.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.2f;
            lightObject.transform.rotation = Quaternion.Euler(48f, -28f, 0f);
        }

        private static void CreateTrack(Material ground, Material border)
        {
            GameObject track = GameObject.CreatePrimitive(PrimitiveType.Cube);
            track.name = "Track";
            track.transform.position = new Vector3(0f, -0.18f, 70f);
            track.transform.localScale = new Vector3(8.6f, 0.3f, 155f);
            track.GetComponent<Renderer>().material = ground;

            CreateBorder(-4.55f, border);
            CreateBorder(4.55f, border);
        }

        private static void CreateBorder(float x, Material material)
        {
            GameObject border = GameObject.CreatePrimitive(PrimitiveType.Cube);
            border.name = "TrackBorder";
            border.transform.position = new Vector3(x, 0.15f, 70f);
            border.transform.localScale = new Vector3(0.22f, 0.6f, 155f);
            border.GetComponent<Renderer>().material = material;
        }

        private static void CreateCamera(Transform target)
        {
            Camera existing = Camera.main;
            GameObject cameraObject;

            if (existing == null)
            {
                cameraObject = new GameObject("Main Camera");
                existing = cameraObject.AddComponent<Camera>();
                cameraObject.tag = "MainCamera";
            }
            else
            {
                cameraObject = existing.gameObject;
            }

            existing.fieldOfView = 57f;
            FollowCamera follow = cameraObject.GetComponent<FollowCamera>();
            if (follow == null) follow = cameraObject.AddComponent<FollowCamera>();
            follow.Target = target;
            follow.Snap();
        }

        private static void CreateGate(Vector3 position, int startValue, int maxValue, Material material)
        {
            GameObject gateObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
            gateObject.name = $"Gate_+{maxValue}";
            gateObject.transform.position = position;
            gateObject.transform.localScale = new Vector3(3.15f, 2.25f, 0.28f);
            gateObject.GetComponent<Renderer>().material = material;
            BoxCollider collider = gateObject.GetComponent<BoxCollider>();
            collider.isTrigger = true;

            Gate gate = gateObject.AddComponent<Gate>();
            gate.Initialize(startValue, maxValue);

            GameObject textObject = new GameObject("GateText");
            textObject.transform.SetParent(gateObject.transform, false);
            textObject.transform.localPosition = new Vector3(0f, 0f, -0.56f);
            textObject.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
            textObject.transform.localScale = Vector3.one * 0.22f;

            TextMesh text = textObject.AddComponent<TextMesh>();
            text.anchor = TextAnchor.MiddleCenter;
            text.alignment = TextAlignment.Center;
            text.fontSize = 72;
            text.characterSize = 0.12f;
            text.color = Color.white;
            gate.Label = text;
            gate.RefreshLabel();
        }

        private static void CreateEnemyWave(Vector3 origin, int count, int columns, Material material)
        {
            const float spacingX = 0.78f;
            const float spacingZ = 0.82f;

            for (int i = 0; i < count; i++)
            {
                int row = i / columns;
                int col = i % columns;
                int rowCount = Mathf.Min(columns, count - row * columns);
                float width = (rowCount - 1) * spacingX;

                Vector3 pos = origin + new Vector3(col * spacingX - width * 0.5f, 0f, row * spacingZ);
                GameObject enemyObject = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                enemyObject.name = "Enemy";
                enemyObject.transform.position = pos;
                enemyObject.transform.localScale = new Vector3(0.42f, 0.55f, 0.42f);
                enemyObject.GetComponent<Renderer>().material = material;
                Collider collider = enemyObject.GetComponent<Collider>();
                collider.isTrigger = true;
                EnemyUnit enemy = enemyObject.AddComponent<EnemyUnit>();
                enemy.Health = 2f;
            }
        }

        private static void CreateFinishMarker(Vector3 position, Material material)
        {
            GameObject marker = GameObject.CreatePrimitive(PrimitiveType.Cube);
            marker.name = "Finish";
            marker.transform.position = position;
            marker.transform.localScale = new Vector3(8f, 0.05f, 0.7f);
            marker.GetComponent<Renderer>().material = material;
        }
    }

    public enum RunState
    {
        Running,
        Victory,
        GameOver
    }

    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }
        public SquadController Squad { get; set; }
        public BossUnit Boss { get; set; }
        public RunState State { get; private set; } = RunState.Running;

        private GUIStyle largeStyle;
        private GUIStyle smallStyle;

        private void Awake()
        {
            Instance = this;
        }

        public void Win()
        {
            if (State != RunState.Running) return;
            State = RunState.Victory;
        }

        public void Lose()
        {
            if (State != RunState.Running) return;
            State = RunState.GameOver;
        }

        private void OnGUI()
        {
            largeStyle ??= new GUIStyle(GUI.skin.label)
            {
                fontSize = Mathf.RoundToInt(Screen.width * 0.055f),
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Color.white }
            };

            smallStyle ??= new GUIStyle(GUI.skin.label)
            {
                fontSize = Mathf.RoundToInt(Screen.width * 0.038f),
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Color.white }
            };

            if (Squad != null)
                GUI.Label(new Rect(0, 22, Screen.width, 70), $"ARMY  {Squad.Count}", largeStyle);

            if (Boss != null && Boss.Health > 0f)
                GUI.Label(new Rect(0, 85, Screen.width, 55), $"BOSS  {Mathf.CeilToInt(Boss.Health)} HP", smallStyle);

            if (State == RunState.Victory)
                GUI.Label(new Rect(0, Screen.height * 0.42f, Screen.width, 100), "VICTORY 🌊", largeStyle);
            else if (State == RunState.GameOver)
                GUI.Label(new Rect(0, Screen.height * 0.42f, Screen.width, 100), "RUN OVER", largeStyle);
        }
    }

    public class SquadController : MonoBehaviour
    {
        private readonly List<Transform> soldiers = new List<Transform>();
        private Material soldierMaterial;
        private Material bulletMaterial;
        private float fireTimer;
        private bool dragging;
        private float lastPointerX;

        public int Count => soldiers.Count;
        public float ForwardSpeed = 5.6f;
        public float HorizontalSensitivity = 0.018f;
        public float FireInterval = 0.20f;
        public float HorizontalLimit = 3.2f;
        public int MaxSoldiers = 260;

        public void Initialize(Material soldierMat, Material bulletMat, int startingCount)
        {
            soldierMaterial = soldierMat;
            bulletMaterial = bulletMat;
            AddSoldiers(startingCount);
        }

        private void Update()
        {
            if (GameManager.Instance == null || GameManager.Instance.State != RunState.Running) return;

            transform.position += Vector3.forward * ForwardSpeed * Time.deltaTime;
            HandleInput();
            HandleFire();
        }

        private void HandleInput()
        {
            float x = 0f;
            bool down = false;
            bool held = false;
            bool up = false;

            if (Input.touchCount > 0)
            {
                Touch touch = Input.GetTouch(0);
                x = touch.position.x;
                down = touch.phase == TouchPhase.Began;
                held = touch.phase == TouchPhase.Moved || touch.phase == TouchPhase.Stationary;
                up = touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled;
            }
            else
            {
                x = Input.mousePosition.x;
                down = Input.GetMouseButtonDown(0);
                held = Input.GetMouseButton(0);
                up = Input.GetMouseButtonUp(0);
            }

            if (down)
            {
                dragging = true;
                lastPointerX = x;
            }

            if (dragging && held)
            {
                float delta = x - lastPointerX;
                lastPointerX = x;
                Vector3 p = transform.position;
                p.x = Mathf.Clamp(p.x + delta * HorizontalSensitivity, -HorizontalLimit, HorizontalLimit);
                transform.position = p;
            }

            if (up) dragging = false;
        }

        private void HandleFire()
        {
            fireTimer -= Time.deltaTime;
            if (fireTimer > 0f || soldiers.Count == 0) return;
            fireTimer = FireInterval;

            int shooterCount = Mathf.Min(28, soldiers.Count);
            float damagePerShot = soldiers.Count / (float)shooterCount;
            float step = soldiers.Count / (float)shooterCount;

            for (int i = 0; i < shooterCount; i++)
            {
                int index = Mathf.Min(soldiers.Count - 1, Mathf.FloorToInt(i * step));
                Transform soldier = soldiers[index];
                CreateProjectile(soldier.position + new Vector3(0f, 0.12f, 0.36f), damagePerShot);
            }
        }

        private void CreateProjectile(Vector3 position, float damage)
        {
            GameObject bullet = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            bullet.name = "Bullet";
            bullet.transform.position = position;
            bullet.transform.localScale = new Vector3(0.09f, 0.09f, 0.17f);
            bullet.GetComponent<Renderer>().material = bulletMaterial;
            SphereCollider collider = bullet.GetComponent<SphereCollider>();
            collider.isTrigger = true;
            Rigidbody rb = bullet.AddComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;
            Projectile projectile = bullet.AddComponent<Projectile>();
            projectile.Damage = damage;
        }

        public void AddSoldiers(int amount)
        {
            int target = Mathf.Min(MaxSoldiers, Count + Mathf.Max(0, amount));
            while (Count < target)
            {
                GameObject soldier = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                soldier.name = "Soldier";
                soldier.transform.SetParent(transform, false);
                soldier.transform.localScale = new Vector3(0.30f, 0.42f, 0.30f);
                soldier.GetComponent<Renderer>().material = soldierMaterial;
                Collider collider = soldier.GetComponent<Collider>();
                if (collider != null) Destroy(collider);
                soldiers.Add(soldier.transform);
            }

            RebuildFormation();
        }

        public void RemoveSoldiers(int amount)
        {
            int remove = Mathf.Min(Mathf.Max(0, amount), Count);
            for (int i = 0; i < remove; i++)
            {
                int last = soldiers.Count - 1;
                Transform soldier = soldiers[last];
                soldiers.RemoveAt(last);
                if (soldier != null) Destroy(soldier.gameObject);
            }

            RebuildFormation();
            if (Count == 0 && GameManager.Instance != null) GameManager.Instance.Lose();
        }

        private void RebuildFormation()
        {
            if (Count == 0) return;

            int columns = Mathf.Clamp(Mathf.CeilToInt(Mathf.Sqrt(Count * 1.35f)), 1, 16);
            const float xSpacing = 0.38f;
            const float zSpacing = 0.40f;

            for (int i = 0; i < Count; i++)
            {
                int row = i / columns;
                int col = i % columns;
                int rowCount = Mathf.Min(columns, Count - row * columns);
                float width = (rowCount - 1) * xSpacing;
                soldiers[i].localPosition = new Vector3(col * xSpacing - width * 0.5f, 0f, -row * zSpacing);
            }
        }
    }

    public class Projectile : MonoBehaviour
    {
        public float Damage = 1f;
        public float Speed = 30f;
        private float life = 2.7f;

        private void Update()
        {
            transform.position += Vector3.forward * Speed * Time.deltaTime;
            life -= Time.deltaTime;
            if (life <= 0f) Destroy(gameObject);
        }

        private void OnTriggerEnter(Collider other)
        {
            Gate gate = other.GetComponent<Gate>();
            if (gate != null)
            {
                gate.Hit(Damage);
                Destroy(gameObject);
                return;
            }

            BossUnit boss = other.GetComponent<BossUnit>();
            if (boss != null)
            {
                boss.Hit(Damage);
                Destroy(gameObject);
                return;
            }

            EnemyUnit enemy = other.GetComponent<EnemyUnit>();
            if (enemy != null)
            {
                enemy.Hit(Damage);
                Destroy(gameObject);
            }
        }
    }

    public class Gate : MonoBehaviour
    {
        private int value;
        private int maxValue;
        private bool consumed;
        public TextMesh Label { get; set; }

        public void Initialize(int startValue, int max)
        {
            value = Mathf.Max(1, startValue);
            maxValue = Mathf.Max(value, max);
        }

        public void Hit(float damage)
        {
            if (consumed) return;
            int increase = Mathf.Max(1, Mathf.RoundToInt(damage));
            value = Mathf.Min(maxValue, value + increase);
            RefreshLabel();
        }

        public void RefreshLabel()
        {
            if (Label != null) Label.text = $"+{value}";
        }

        private void OnTriggerEnter(Collider other)
        {
            if (consumed) return;
            SquadController squad = other.GetComponent<SquadController>();
            if (squad == null) return;

            consumed = true;
            squad.AddSoldiers(value);
            gameObject.SetActive(false);
        }
    }

    public class EnemyUnit : MonoBehaviour
    {
        public float Health = 2f;
        private bool dead;

        public void Hit(float damage)
        {
            if (dead) return;
            Health -= damage;
            if (Health <= 0f)
            {
                dead = true;
                Destroy(gameObject);
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            if (dead) return;
            SquadController squad = other.GetComponent<SquadController>();
            if (squad == null) return;

            dead = true;
            squad.RemoveSoldiers(1);
            Destroy(gameObject);
        }
    }

    public class BossUnit : MonoBehaviour
    {
        public float Health { get; private set; }
        private bool dead;

        public void Initialize(float hp)
        {
            Health = hp;
        }

        public void Hit(float damage)
        {
            if (dead) return;
            Health -= damage;
            if (Health <= 0f)
            {
                Health = 0f;
                dead = true;
                if (GameManager.Instance != null) GameManager.Instance.Win();
                Destroy(gameObject);
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            if (dead) return;
            SquadController squad = other.GetComponent<SquadController>();
            if (squad == null) return;
            squad.RemoveSoldiers(Mathf.Min(15, squad.Count));
        }
    }

    public class FollowCamera : MonoBehaviour
    {
        public Transform Target;
        public Vector3 Offset = new Vector3(0f, 8.8f, -11.5f);
        public float Smoothness = 8f;

        public void Snap()
        {
            if (Target == null) return;
            transform.position = Target.position + Offset;
            transform.rotation = Quaternion.Euler(31f, 0f, 0f);
        }

        private void LateUpdate()
        {
            if (Target == null) return;
            Vector3 wanted = Target.position + Offset;
            transform.position = Vector3.Lerp(transform.position, wanted, 1f - Mathf.Exp(-Smoothness * Time.deltaTime));
            transform.rotation = Quaternion.Euler(31f, 0f, 0f);
        }
    }
}
