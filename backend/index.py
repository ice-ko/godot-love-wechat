import os
import threading
import subprocess
import zipfile
import pathlib
import re
import json
import base64
from io import StringIO
from time import time

import webview


def parse_godot_project(file_path):
	"""使用正则表达式解析 Godot project.godot 文件"""
	# 定义正则表达式
	section_pattern = re.compile(r"^\[(.+?)\]$")  # 匹配 [section]
	key_value_pattern = re.compile(r"^([\w/]+)=(.+)$")  # 匹配 key=value

	# 存储解析结果
	result = {}
	current_section = None

	with open(file_path, "r", encoding="utf-8") as f:
		for line in f:
			# 去掉空行和注释
			line = line.strip()
			if not line or line.startswith(";"):
				continue

			# 检查是否是一个 section
			section_match = section_pattern.match(line)
			if section_match:
				current_section = section_match.group(1)
				result[current_section] = {}
				continue

			# 检查是否是一个 key=value 对
			key_value_match = key_value_pattern.match(line)
			if key_value_match and current_section:
				key, value = key_value_match.groups()
				# 去掉两侧的引号
				value = value.strip().strip('"')
				result[current_section][key] = value

	return result


class Api:
	def get_settings(self):
		path = "./settings.json"
		if os.path.exists(path):
			with open(path, "r") as f:
				settings = f.read()
			return json.loads(settings)
		return {"godotExecute": ""}

	def save_settings(self, data):
		path = "./settings.json"
		with open(path, "w+") as f:
			f.write(json.dumps(data, indent=2))

	def save_export_settings(self, projectPath, settings):
		export_settings_path = os.path.join(projectPath, "minigame.export.json")
		with open(export_settings_path, "w+") as f:
			f.write(json.dumps(settings, indent=2))

	def get_export_settings(self, projectPath):
		export_settings_path = os.path.join(projectPath, "minigame.export.json")
		with open(export_settings_path, "r") as f:
			export_settings = json.loads(f.read())
		return export_settings

	def get_godot_execute(self):
		filename = webview.active_window().create_file_dialog(
			dialog_type=webview.OPEN_DIALOG,
			allow_multiple=False,
			directory="~",
			file_types=("Godot Execute (*.exe)",),
		)
		if not filename:
			return
		return filename

	def read_projects(self):
		path = "./projects.json"
		if os.path.exists(path):
			with open(path, "r") as f:
				projects = f.read()
				projects = json.loads(projects)
			_projects = []
			for project in projects:
				with open(project["icon"], "rb") as img_file:
					encoded_string = base64.b64encode(img_file.read()).decode("utf-8")
				project["iconPath"] = encoded_string
				_projects.append(project)
			return _projects
		return []

	def open_projects(self):
		folder = webview.active_window().create_file_dialog(
			dialog_type=webview.FOLDER_DIALOG, directory="", allow_multiple=False
		)
		folder = folder[0]
		godot_project = os.path.join(folder, "project.godot")

		project_data = parse_godot_project(godot_project)
		application = project_data["application"]
		project = {
			"name": application.get("config/name", ""),
			"path": folder,
			"version": application.get("config/version", ""),
			"description": application.get("config/description", ""),
			"icon": (
				application.get("config/icon", "").split("//")[-1]
				if application.get("config/icon", "")
				else "icon.svg"
			),
		}
		project["icon"] = os.path.join(folder, project["icon"])
		# 添加数据到文件
		self.append_to_json(project)

		projects = self.read_projects()
		return projects
	
	def append_to_json(self,new_data):
		project_path = "./projects.json"
		# 如果文件不存在，创建一个包含空数组的文件
		if not os.path.exists(project_path):
			with open(project_path, "w") as f:
				json.dump([], f)
		
		# 读取现有数据
		with open(project_path, "r") as f:
			try:
				existing_data = json.load(f)
			except json.JSONDecodeError:
				existing_data = []
		
		# 追加新数据
		existing_data.append(new_data)
		
		# 写回文件
		with open(project_path, "w") as f:
			json.dump(existing_data, f, indent=2)
		def open_export_path(self, project_path):
			export_folder = webview.active_window().create_file_dialog(
				dialog_type=webview.FOLDER_DIALOG, directory="", allow_multiple=False
			)
			print(project_path)
			export_folder = pathlib.Path(export_folder[0])
			project_path = pathlib.Path(project_path)
			return export_folder.relative_to(project_path).as_posix()

	def export_game(self, project_path, export_path, project, appid):
		def exists(path):
			return os.path.exists(os.path.join(os.path.dirname(__file__), path))

		def get_template_resource_path(project_type):
			if exists(f"./resources/minigame.{project_type}.zip"):
				return os.path.join(
					os.path.dirname(__file__),
					f"./resources/minigame.{project_type}.zip",
				)
			if exists(f"../resources/minigame.{project_type}.zip"):
				return os.path.join(
					os.path.dirname(__file__),
					f"../resources/minigame.{project_type}.zip",
				)
			raise Exception("not found export template")

		def save_game_json(path, game_json):
			game_json_path = os.path.join(path, "game.json")
			with open(game_json_path, "w+") as f:
				f.write(json.dumps(game_json, indent=2))

		def read_game_json(path):
			game_json = os.path.join(path, "game.json")
			with open(game_json, "r") as f:
				_game_json = json.loads(f.read())
			return _game_json

		def read_project_private_json(path):
			private_json_path = os.path.join(path, "project.private.config.json")
			with open(private_json_path, "r", encoding="utf-8") as f:
				private_json = json.loads(f.read())
			return private_json

		def save_project_private_json(path, data):
			private_json_path = os.path.join(path, "project.private.config.json")
			with open(private_json_path, "w+", encoding="utf-8") as f:
				f.write(json.dumps(data, indent=2))

		settings = self.get_settings()
		godot_execute = settings["godotExecute"]

		export_path = os.path.join(project_path, export_path)
		export_settings = self.get_export_settings(project_path)
		project_type = export_settings.get("projectType", "full")
		with zipfile.ZipFile(get_template_resource_path(project_type), "r") as zf:
			zf.extractall(export_path)
		# 重写gamejson
		game_json = read_game_json(export_path)
		game_json["deviceOrientation"] = export_settings.get(
			"deviceOrientation", "portrait"
		)
		save_game_json(export_path, game_json)
		# 重写project.private.config.json
		private_json = read_project_private_json(export_path)
		private_json["projectname"] = project.get("name", "")
		private_json["description"] = project.get("description", "")
		private_json["appid"] = appid
		save_project_private_json(export_path, private_json)

		# TODO: 分包处理？
		if export_settings.get("subPackages", ""):
			pass
		else:
			pckPath = os.path.join(export_path, "engine/godot.zip")
			result = subprocess.run(
				[
					godot_execute,
					"--headless",
					"--path",
					project_path,
					"--export-pack",
					"Web",
					pckPath,
				]
			)
			print(result)


def get_entrypoint():
	def exists(path):
		return os.path.exists(os.path.join(os.path.dirname(__file__), path))

	if exists("../gui/index.html"):  # unfrozen development
		return "../gui/index.html"

	if exists("../Resources/gui/index.html"):  # frozen py2app
		return "../Resources/gui/index.html"

	if exists("./gui/index.html"):
		return "./gui/index.html"

	raise Exception("No index.html found")


entry = get_entrypoint()


if __name__ == "__main__":
	window = webview.create_window(
		"Godot小游戏导出工具",
		entry,
		js_api=Api(),
		width=1024,
		height=800,
		min_size=(1024, 800),
	)
	window.settings = {
		"ALLOW_FILE_URLS": True,
		"OPEN_EXTERNAL_LINKS_IN_BROWSER": True,
		"OPEN_DEVTOOLS_IN_DEBUG": True,
	}
	webview.start()
